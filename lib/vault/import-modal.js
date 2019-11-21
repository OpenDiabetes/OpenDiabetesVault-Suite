'use babel';

/** @jsx etch.dom */

import etch from 'etch';
import path from 'path';
import Modal from '../modal'
import util from '../util';
import process from '../process';
import gunzip from 'gunzip-file';

export default class ImportModal {
  constructor() {
    this.fileLabel = 'Select files';
    etch.initialize(this);
  }

  render() {
    return (
      <Modal ref="modal">
        <h2 className="modal-title">Data Import</h2>
        <div>Please choose how you want to import data in the current repository:</div>
        <div className="checklist-container">
          <div className="checklist-item" on={{click: this.setType}}>
            CSV
            <input type="radio" ref="csv"/>
            <span className="checklist-mark"></span>
          </div>
          <div className="checklist-item" on={{click: this.setType}}>
            JSON
            <input type="radio" ref="json"/>
            <span className="checklist-mark"></span>
          </div>
          <div className="checklist-item" on={{click: this.setType}}>
            Nightscout
            <input type="radio" ref="ns"/>
            <span className="checklist-mark"></span>
          </div>
        </div>
        <input type="file" multiple className="input-file" id="files" on={{change: this.setFiles}}/>
        <label htmlFor="files" className="btn btn-primary" id="fileLabel">{this.fileLabel}</label>
        <br/>
        <div className="text-error" id="errorText"></div>
        <button className="btn inline-block-tight btn-modal btn-warning" on={{click: this.import}}>Start Import</button>
        <button className="btn inline-block-tight btn-modal" on={{click: this.close}}>Cancel</button>
        <div className="process-output" id="importOutput"></div>
      </Modal>
    );
  }

  close() {
    this.refs.modal.destroy()
  }

  setType(event) {
    let target;
    // check if checklist-item div or checklist-mark span was clicked
    if (event.target.localName === 'div')
      target = event.target;
    else target = event.target.parentElement;

    switch (target.childNodes[0].data) {
      case 'CSV':
        this.refs.csv.setAttribute('checked', true);
        this.refs.json.removeAttribute('checked');
        this.refs.ns.removeAttribute('checked');
        this.type = 'ODV_CSV';
        break;
      case 'JSON':
        this.refs.csv.removeAttribute('checked');
        this.refs.json.setAttribute('checked', true);
        this.refs.ns.removeAttribute('checked');
        this.type = 'ODV_JSON';
        break;
      case 'Nightscout':
        this.refs.csv.removeAttribute('checked');
        this.refs.json.removeAttribute('checked');
        this.refs.ns.setAttribute('checked', true);
        this.type = 'NIGHTSCOUT';
        break;
    }
  }

  setFiles(event) {
    this.files = event.target.files;
    if (this.files.length > 1) {
      this.fileLabel = this.files.length + ' files selected';
    } else if (this.files.length === 1) {
      this.fileLabel = this.files[0].name;
    } else {
      this.fileLabel = 'Select files';
    }
    document.getElementById('fileLabel').innerHTML = this.fileLabel;
  }

  import(event) {
    if (!this.type || !this.files || this.files.length === 0) {
      document.getElementById('errorText').innerHTML = 'Please select an import type and which files to import!';
      return;
    }
    document.getElementById('errorText').innerHTML = '';
    const button = event.target;
    button.setAttribute('disabled', true);
    const output = document.getElementById('importOutput');

    let files = [];
    // unzip archives if needed
    Promise.all(Array.from(this.files).map(file => {
      if (path.extname(file.name) === '.gz') {
        const newFile = path.join(path.dirname(file.path), path.basename(file.path, '.gz'));
        files.push(newFile);
        return new Promise(resolve => {
          gunzip(file.path, newFile, () => resolve())
        });
      } else {
        files.push(file.path);
        return Promise.resolve();
      }
    })).then(() => {
      let common;
      if (process.isDockerEnabled(process.CLI)) {
        // take the paths of all files
        // find the common path that will be mounted
        common = util.findCommonPath(files);
        // convert all paths to relative paths from the common path and join them with the mount
        files = files.map(f => '"' + path.posix.resolve('/mnt/import', path.relative(common, f)) + '"').join(' ');
      } else {
        files = files.map(f => '"' + f + '"').join(' ');
      }
      const prc = new process.Process('import', {
        type: this.type,
        files: files
      });
      // when using docker we have to mount the directory into the container
      if (process.isDockerEnabled(process.CLI))
        prc.addBind(common, '/mnt/import');
      prc.onstdout = stdout => {
        const msg = document.createElement('div');
        msg.classList.add('text-highlight');
        msg.innerHTML = stdout;
        output.appendChild(msg);
        output.scrollTop = output.scrollHeight;
      };
      prc.onstderr = stderr => {
        const msg = document.createElement('div');
        msg.classList.add('text-error');
        msg.innerHTML = stderr;
        output.appendChild(msg);
        output.scrollTop = output.scrollHeight;
      };
      prc.execute()
        .then(() => {
          button.removeAttribute('disabled');
          etch.destroy(this);
          atom.notifications.addSuccess('Import finished successfully');
        })
        .catch(() => {
          button.removeAttribute('disabled');
        });
    });
  }

  update() {
    etch.update(this);
  }
}
