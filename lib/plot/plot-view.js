'use babel';

/** @jsx etch.dom */

import {watchPath} from 'atom';
import csv from 'fast-csv';
import etch from 'etch';
import fs from 'fs-extra';
import md5 from 'md5-file/promise';
import path from 'path';
import slash from 'slash';
import uuid from 'uuid/v4';
import cache from '../tag-cache';
import process from '../process';
import util from '../util';
import Toolbar from './toolbar';
import {Canvas, ensureCached} from './canvas';
import SliceLabel from './slice-label';
import {VIEW_BIG, VIEW_DAILY, VIEW_NORMAL, VIEW_TINY} from './view-size';

const STATUS_IDLE = 'idle';
const STATUS_EXPORT = 'export';
const STATUS_GENERATE = 'generate';

// set pdf worker source
const pdf = require('pdfjs-dist');
pdf.GlobalWorkerOptions.workerSrc = path.resolve(util.getModulePath(), '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.js');

export default class PlotView {
  // serializable state of the view
  status = STATUS_IDLE;
  view = VIEW_DAILY;
  scale = 1.0;
  tag = null;
  dir = null;
  currentPage = 0;
  canvas1 = null;
  canvas2 = null;
  canvas3 = null;
  labels = false;
  sliceTag = null;

  // transient state of the view
  pdfs = [];
  allPdfs = [];
  slices = [];

  /**
   * The process currently watching files
   * @type {Promise|null}
   */
  watcher = null;
  /**
   * The process currently generating plots, if in status generate
   * @type {Process|null}
   */
  process = null;

  constructor(serialized) {
    if (serialized != null && typeof (serialized) == 'object') {
      this.id = serialized.id;
      this.view = serialized.view;
      this.scale = serialized.scale;
      this.tag = serialized.tag;
      this.dir = serialized.dir;
      this.currentPage = serialized.currentPage;
      this.canvas1 = serialized.canvas1;
      this.canvas2 = serialized.canvas2;
      this.canvas3 = serialized.canvas3;
      this.labels = serialized.labels;
      this.sliceTag = serialized.sliceTag;
    } else if (serialized != null && typeof (serialized) == 'string') {
      this.id = id;
    } else {
      // create random id for this view
      this.id = uuid();
    }

    etch.initialize(this);
    if (this.dir) {
      this.watchFiles();
      this.checkSliceExists().then(exists => {
        if (exists)
          this.loadSlices(this.getSlicePath());
      })
    }
  }

  render() {
    const children = [];

    children.push(<Canvas ref="canvas1" scale={this.scale} url={this.canvas1} labels={this.labels}/>);
    if (this.view === VIEW_NORMAL || this.view === VIEW_TINY)
      children.push(<Canvas ref="canvas2" scale={this.scale} url={this.canvas2}/>);
    if (this.view === VIEW_TINY)
      children.push(<Canvas ref="canvas2" scale={this.scale} url={this.canvas3}/>);

    if (this.view !== VIEW_DAILY && this.labels && this.pdfs.length > 0 && this.slices.length > 0) {
      if (this.slices.length < this.currentPage) {
        atom.notifications.addError('Invalid number of slices found!', {
          description: 'Expected at least ' + this.currentPage + ' slices but found ' + this.slices.length + '.',
          dismissable: true
        });
      } else {
        const labels = this.slices
          .filter(s => s.label)
          .map(s => s.label)
          .filter(util.isUnique)
          .sort();
        children.push(<SliceLabel plot={this} labels={labels} currentSlice={this.slices[this.currentPage - 1]}
                                  tag={this.sliceTag}/>);
      }
    }

    return (
      <div>
        <Toolbar ref="toolbar" plot={this} tag={this.tag} currentPage={this.currentPage} maxPage={this.pdfs.length}
                 view={this.view} labels={this.labels} inProgress={this.status !== STATUS_IDLE}/>
        {children}
      </div>
    );
  }

  nextPage() {
    if (this.currentPage < this.pdfs.length) {
      this.currentPage++;
      this.renderCurrentPdf();
      etch.update(this);
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderCurrentPdf();
      etch.update(this);
    }
  }

  setPage(page) {
    if (page >= 1 && page <= this.pdfs.length) {
      this.currentPage = page;
      this.renderCurrentPdf();
      etch.update(this);
    }
  }

  zoomIn() {
    this.scale += 0.1;
    this.renderCurrentPdf();
    etch.update(this);
  }

  zoomOut() {
    this.scale -= 0.1;
    this.renderCurrentPdf();
    etch.update(this);
  }

  setViewSize(size) {
    const update = this.view !== size;
    this.view = size;
    if (update && this.dir) {
      this.canvas1 = null;
      this.canvas2 = null;
      this.canvas3 = null;
      this.updatePdfs();
    }
    etch.update(this);
  }

  toggleLabels() {
    this.labels = !this.labels;
    etch.update(this);
  }

  labelCurrentSlice(label) {
    const currentSlice = this.slices[this.currentPage - 1];
    if (label) {
      currentSlice.label = label;
      currentSlice.labelSource = 'manual';
    } else {
      currentSlice.label = '';
      currentSlice.labelSource = '';
    }
  }

  setSliceTag(tag) {
    this.sliceTag = tag;
  }

  saveSlices() {
    return new Promise(resolve => {
      const file = this.getSlicePath();
      csv.writeToPath(file, this.slices, {headers: true})
        .on('finish', () => {
          const relFile = process.isDockerEnabled(process.CLI) ? slash(util.getRelativeProjectPath(file)) : util.getRelativeProjectPath(file);
          new process.Process('importslice', {
            file: relFile,
            tag: this.sliceTag
          }).execute().then(() => {
            atom.notifications.addSuccess('Slices saved to disk.');
            resolve();
          });
        });
    });
  }

  setTag(tag) {
    this.tag = tag;
    if (!tag && this.view !== VIEW_DAILY)
      this.view = VIEW_DAILY;
    if (cache.hasTagCached(tag)) {
      this.dir = path.join(util.getProjectPath(), 'plots', cache.getTagCache(tag));
      this.checkSliceExists().then(exists => {
        if (exists)
          this.loadSlices(this.getSlicePath());
      });
      this.watchFiles();
      etch.update(this);
    } else {
      this.dir = null;
      this.slices = [];
      this.stopWatchFiles();
      this.clearCurrentPdfs();
    }
  }

  updatePlots() {
    if (this.status !== STATUS_IDLE)
      throw new Error(`Cannot update plots while in status ${this.status}!`);

    this.checkDataExists().then(exists => {
      // if data does not exist, export it first
      if (!exists)
        return this.exportData();
      else return Promise.resolve();
    }).then(() => {
      // generate plots
      this.generatePlots();
    })
  }

  cancelPlots() {
    if (this.status === STATUS_IDLE)
      throw new Error(`Cannot cancel plot generation while in status ${this.status}!`);

    if (this.process !== null)
      this.process.dispose();
    this.status = STATUS_IDLE;
    this.process = null;
    this.stopWatchFiles();
    etch.update(this);
  }

  deletePlots() {
    if (this.status !== STATUS_IDLE)
      throw new Error(`Cannot delete plots while in status ${this.status}!`);

    atom.confirm({
      message: 'Delete plots?',
      buttons: [
        'Delete Current View (' + this.pdfs.length + ')',
        'Delete All Plots (' + this.allPdfs.length + ')',
        'Delete All Plots And Exported Data',
        'Cancel',
      ],
      defaultId: 3,
      type: 'warning',
    }, response => {
      if (response === 3)
        return;
      new Promise(resolve => {
        switch (response) {
          case 0:
            this.pdfs.reduce((promise, pdf) => {
              promise.then(() => {
                return fs.remove(path.join(this.dir, pdf));
              });
              return promise;
            }, Promise.resolve()).then(() => {
              this.clearCurrentPdfs();
              resolve();
            });
            break;
          case 1:
            this.clearCurrentPdfs();
            this.allPdfs.reduce((promise, pdf) => {
              promise.then(() => {
                return fs.remove(path.join(this.dir, pdf));
              });
              return promise;
            }, Promise.resolve()).then(() => {
              this.allPdfs = [];
              resolve();
            });
            break;
          case 2:
            this.clearCurrentPdfs();
            this.allPdfs.reduce((promise, pdf) => {
              return promise.then(() => {
                return fs.remove(path.join(this.dir, pdf));
              });
            }, Promise.all([
              fs.remove(this.getDataPath()),
              fs.remove(this.getSlicePath())
            ])).then(() => {
              this.allPdfs = [];
              cache.unsetTagCache(this.tag);
              resolve();
            });
            break;
        }
      }).then(() => {
        atom.notifications.addInfo('All plots deleted.');
      });
    });
  }

  /**
   * Exports data for the given tag
   * @returns {Promise<string>}
   */
  exportData() {
    if (this.status !== STATUS_IDLE) {
      throw new Error(`Cannot export tag while in status ${this.status}!`);
    }
    this.status = STATUS_EXPORT;
    this.refs.toolbar.updateProgress('Exporting data...');
    etch.update(this);

    // export
    let xprt;
    if (this.tag) {
      xprt = new process.Process('exporttagged', {
        type: 'ODV_CSV',
        tag: this.tag
      });
    } else {
      xprt = new process.Process('export', {
        type: 'ODV_CSV'
      });
    }
    return xprt.execute().then(result => {
      let file = result.match(/Export data to file: (.+\.csv)/);
      if (!Array.isArray(file) || file.length < 2 || !file[1]) {
        atom.notifications.addError('Export unsuccessful!', {
          detail: result
        });
        this.status = STATUS_IDLE;
        etch.update(this);
        return Promise.reject('SIGTERM');
      }
      file = path.join(util.getProjectPath(), 'export', file[1]);

      let slice = result.match(/Export slice information to file: (.+\.csv)/);
      if (!Array.isArray(slice) || slice.length < 2 || !file[1]) {
        slice = null;
      } else slice = path.join(util.getProjectPath(), 'export', slice[1]);

      // generate hash for file
      return md5(file).then(hash => {
        cache.setTagCache(this.tag, hash);
        if (this.status !== STATUS_EXPORT)
          return Promise.reject('SIGTERM');

        // generate directory
        const dir = path.join(util.getProjectPath(), 'plots', hash);
        return fs.mkdirs(dir).then(() => {
          this.dir = dir;

          // move data
          const newFile = path.join(dir, 'data.csv');
          return fs.move(file, newFile, {overwrite: true}).then(() => {
            if (slice == null) {
              etch.update(this);
              this.slices = [];
              return Promise.resolve();
            }

            // move slices
            const newSlice = path.join(dir, 'slices.csv');
            return fs.move(slice, newSlice, {overwrite: true}).then(() => {
              // Load slices
              return this.loadSlices(newSlice);
            });
          });
        });
      });
    }).catch(result => {
      atom.notifications.addError('Exception while trying to export!', {
        detail: result,
        dismissable: true
      });
      this.status = STATUS_IDLE;
      etch.update(this);
    });
  }

  loadSlices(file) {
    return new Promise((resolve, reject) => {
      const slices = [];
      csv.parseFile(file, {headers: true})
        .on('data', row => {
          slices.push(row);
        })
        .on('end', () => {
          this.slices = slices;
          etch.update(this);
          resolve();
        })
        .on('error', err => {
          this.slices = [];
          etch.update(this);
          reject(err);
        });
    });
  }

  /**
   * Generates plot for the exported file.
   */
  generatePlots() {
    if (this.status !== STATUS_EXPORT && this.status !== STATUS_IDLE) {
      throw new Error(`Cannot export tag while in status ${this.status}!`);
    }

    this.checkDataExists().then(exists => {
      // check that data exists
      if (!exists) {
        atom.notifications.addError('No data file found!', {
          detail: this.getDataPath(),
          dismissable: true
        });
        return;
      }
      const file = this.getDataPath();

      // generate plots
      this.status = STATUS_GENERATE;
      this.refs.toolbar.updateProgress('Generating plots...');
      etch.update(this);

      new Promise((resolve, reject) => {
        this.checkSliceExists().then(exists => {
          if (!exists && this.view !== VIEW_DAILY) {
            reject('No slice file for view size ' + this.view + ' found.');
            return;
          }

          let args;
          if (process.isDockerEnabled(process.PLOT)) {
            args = {
              // construct container path to file
              file: path.posix.join('/mnt/project', slash(util.getRelativeProjectPath(file))),
              // construct container path to slice
              slice: exists ? path.posix.join('/mnt/project', slash(util.getRelativeProjectPath(this.getSlicePath()))) : '',
              // construct container path to output directory
              out: path.posix.join('/mnt/project', slash(util.getRelativeProjectPath(this.dir)))
            }
          } else {
            args = {
              file: file,
              slice: exists ? this.getSlicePath() : '',
              out: this.dir
            }
          }
          const prc = new process.Process('plot-' + this.view, args, process.PLOT);
          prc.execute()
            .then(() => resolve())
            .catch(err => {
              // check if process was disposed (cancel button)
              if (prc.disposed)
                reject('SIGTERM');
              else reject(err);
            });
          this.process = prc;
          this.watchFiles();
        });
        // Generation process promise end
      }).then(() => {
        this.status = STATUS_IDLE;
        this.process = null;
        etch.update(this);
      }).catch(err => {
        if (err !== 'SIGTERM') {  // if not cancelled
          console.error(err);
          atom.notifications.addError('Error while generating plots!', {
            detail: err,
            dismissable: true
          });
        }
        this.status = STATUS_IDLE;
        this.process = null;
        etch.update(this);
      });
    });
  }

  /**
   * Starts watching the current directory for plots
   */
  watchFiles() {
    this.stopWatchFiles().then(() => {
      this.updatePdfs();
      // https://flight-manual.atom.io/api/v1.39.1/PathWatcher/
      this.watcher = watchPath(this.dir, {}, events => {
        let update = false;
        for (const event of events) {
          // freshly created plots ('created' event) contain no data yet, wait for 'modified' event
          if (event.action === 'modified' && event.path.endsWith('.pdf')) {
            console.debug(`${event.action} ${event.path}`);
            update = true;
          }
        }
        if (update)
          this.updatePdfs();
      });
    });
  }

  stopWatchFiles() {
    return new Promise(resolve => {
      if (this.watcher == null) {
        resolve();
        return;
      }
      this.watcher.then(watcher => {
        watcher.dispose();
        resolve();
      });
      this.watcher = null;
    });
  }

  /**
   * Updates the pdfs in the current directory
   */
  updatePdfs() {
    fs.readdir(this.dir, (err, files) => {
      if (err || !files) {
        this.clearCurrentPdfs();
        return;
      }

      this.allPdfs = [];
      this.pdfs = files.filter(f => {
        if (path.extname(f).toLowerCase() !== '.pdf' || !path.basename(f).startsWith('plot_'))
          return false;

        this.allPdfs.push(f);
        switch (this.view) {
          case VIEW_DAILY:
            return path.basename(f).startsWith('plot_daily_');
          case VIEW_TINY:
            return path.basename(f).startsWith('plot_tinyslice_');
          case VIEW_NORMAL:
            return path.basename(f).startsWith('plot_normalslice_');
          case VIEW_BIG:
            return path.basename(f).startsWith('plot_bigslice_');
        }
        return false;
      }).sort((a, b) => {
        // file names are always plot_<view>_<date> and may have _<number> suffix
        a = path.basename(a).match(/plot_[a-z]+_([0-9]{6})(?:_([0-9]+))?/);
        b = path.basename(b).match(/plot_[a-z]+_([0-9]{6})(?:_([0-9]+))?/);
        // compare by date and then by number
        return a[1].localeCompare(b[1]) || parseInt(a[2] || 0) - parseInt(b[2] || 0);
      });
      if (this.pdfs.length > 0) {
        if (this.currentPage === 0 || this.currentPage > this.pdfs.length)
          this.currentPage = 1;
        this.renderCurrentPdf();
      } else {
        this.clearCurrentPdfs();
      }
      etch.update(this);
    });
  }

  renderCurrentPdf() {
    if (this.pdfs.length === 0)
      return;

    // populate cache
    const preload = atom.config.get('open-diabetes-filter.plot.cache-preload');
    const before = Math.max(0, this.currentPage - preload);
    const after = Math.min(this.pdfs.length, this.currentPage + preload);
    for (let i = before; i < after; i++) {
      ensureCached(this.getPlotPath(this.pdfs[i]));
    }

    switch (this.view) {
      case VIEW_DAILY:
      case VIEW_BIG:
        this.canvas1 = this.getPlotPath(this.pdfs[this.currentPage - 1]);
        this.canvas2 = null;
        this.canvas3 = null;
        break;
      case VIEW_NORMAL:
        this.canvas1 = this.getPlotPath(this.pdfs[this.currentPage - 1]);

        if (this.pdfs.length >= 2 && this.currentPage < this.pdfs.length) {
          this.canvas2 = this.getPlotPath(this.pdfs[this.currentPage]);
        } else {
          this.canvas2 = null;
        }
        this.canvas3 = null;
        break;
      case VIEW_TINY:
        this.canvas1 = this.getPlotPath(this.pdfs[this.currentPage - 1]);

        if (this.pdfs.length >= 3) {
          if (this.currentPage < this.pdfs.length - 1) {
            this.canvas2 = this.getPlotPath(this.pdfs[this.currentPage]);
            this.canvas3 = this.getPlotPath(this.pdfs[this.currentPage + 1]);
          } else if (this.currentPage < this.pdfs.length) {
            this.canvas2 = this.getPlotPath(this.pdfs[this.currentPage]);
            this.canvas3 = null;
          } else {
            this.canvas2 = null;
            this.canvas3 = null;
          }
        } else if (this.pdfs.length >= 2 && this.currentPage < this.pdfs.length) {
          this.canvas2 = this.getPlotPath(this.pdfs[this.currentPage]);
          this.canvas3 = null;
        } else {
          this.canvas2 = null;
          this.canvas3 = null;
        }
        break;
    }
    etch.update(this);
  }

  getPlotPath(pdf) {
    return path.join(this.dir, pdf);
  }

  clearCurrentPdfs() {
    this.pdfs = [];
    this.currentPage = 0;
    this.canvas1 = null;
    this.canvas2 = null;
    this.canvas3 = null;
    etch.update(this);
  }

  checkDataExists() {
    if (!this.dir)
      return Promise.resolve(false);
    return fs.exists(this.getDataPath());
  }

  getDataPath() {
    return this.dir ? path.join(this.dir, 'data.csv') : null;
  }

  checkSliceExists() {
    if (!this.dir)
      return Promise.resolve(false);
    return fs.exists(this.getSlicePath());
  }

  getSlicePath() {
    return this.dir ? path.join(this.dir, 'slices.csv') : null;
  }

  // Tear down any state and detach
  async destroy() {
    if (this.process !== null)
      this.process.dispose();
    this.stopWatchFiles();
    await this.element.remove();
  }

  update() {
    etch.update(this);
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {
    return {
      deserializer: 'open-diabetes-filter/PlotView',
      id: this.id,
      view: this.view,
      scale: this.scale,
      tag: this.tag,
      dir: this.dir,
      currentPage: this.currentPage,
      canvas1: this.canvas1,
      canvas2: this.canvas2,
      canvas3: this.canvas3,
      labels: this.labels,
      sliceTag: this.sliceTag
    };
  }

  getTitle() {
    // Used by Atom for tab text
    return 'Plot View';
  }

  getURI() {
    // Used by Atom to identify the view when toggling.
    return 'atom://open-diabetes-plot/' + this.id;
  }
}
