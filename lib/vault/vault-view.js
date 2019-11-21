'use babel';

/** @jsx etch.dom */

import etch from 'etch';
import util from '../util';
import odv from '../odv';
import {Process} from '../process';
import ImportModal from './import-modal';
import ExportModal from './export-modal';

export default class VaultView {
  project = false;
  initialized = false;
  tags = [];
  status = null;

  watcher = null;

  constructor(serialized) {
    this.project = util.hasProjectDirectory();
    this.initialized = serialized ? serialized.initialized : false;
    this.checkInitialized();
    this.tags = serialized ? serialized.tags : [];
    this.status = serialized ? serialized.status : null;
    if (this.project && this.initialized) {
      this.updateTags();
      this.updateStatus();
    }

    this.watcher = atom.project.onDidChangePaths(() => {
      const project = util.hasProjectDirectory();
      if (!this.project && project) {
        this.initialized = false;
        this.checkInitialized();
      }
      this.project = project;
      etch.update(this);
    });
    etch.initialize(this);
  }

  render() {
    if (this.project) {
      if (this.initialized) {
        const tags = this.tags ? this.tags.map(tag => {
          return <li className="list-item">{tag.tag} <span className="text-subtle">({tag.modified})</span></li>
        }) : [];
        return (
          <div className="m-2" style="overflow: scroll;">
            <div className="btn-group inline-block">
              <button className="btn btn-warning icon icon-cloud-upload" on={{click: this.import}}>
                Import Data
              </button>
              <button className="btn btn-warning icon icon-cloud-download" on={{click: this.export}}>
                Export Data
              </button>
            </div>
            <h4>Tags</h4>
            <ul className="list-group">
              {tags}
            </ul>
            <button className="btn btn-success icon icon-repo-sync" on={{click: this.updateTags}}>
              Update Tags
            </button>
            <h4>Status</h4>
            <div className="process-output mb-1">
              {this.status}
            </div>
            <button className="btn btn-success icon icon-repo-sync" on={{click: this.updateStatus}}>
              Update Status
            </button>
          </div>
        );
      } else {
        return (
          <div className="m-2">
            No OpenDiabetesVault repository found in current project.
            <button className="btn btn-warning icon icon-repo" on={{click: this.initRepo}}>
              Initialize ODV Repository
            </button>
          </div>
        );
      }
    } else {
      return (
        <div className="m-2">
          It seems like you don't have any project directory opened.
          <button className="btn btn-info icon icon-file-directory" on={{click: this.openProject}}>
            Open Project Directory
          </button>
        </div>
      );
    }
  }

  openProject() {
    if (this.project)
      return;
    atom.pickFolder(paths => {
      if (paths) {
        for (const path of paths) {
          atom.project.addPath(path, {
            mustExists: true,
            exact: true
          });
        }
        this.project = true;
        etch.update(this);
      }
    });
  }

  checkInitialized() {
    odv.isVaultInitialized().then(init => {
      if (!this.initialized && init) {
        this.updateTags();
        this.updateStatus();
      }
      this.initialized = init;
      etch.update(this);
    });
  }

  initRepo() {
    if (this.initialized)
      return;
    odv.initializeVault()
      .then(() => {
        this.initialized = true;
        etch.update(this);
      })
      .catch(() => null);
  }

  updateTags() {
    const process = new Process('listtags');
    process.execute()
      .then(stdout => {
        // tags are listed with their last modification date and the name, e.g.
        // 2019.06.24 18:54 -- ALL
        // split the tags using the match, get the name as all characters after the last space
        this.tags = stdout.match(/[0-9]{4}\.[0-9]{2}\.[0-9]{2} [0-9]{2}:[0-9]{2} -- .+/g)
          .map(tag => {
            const i = tag.indexOf(' -- ');
            return {
              modified: tag.substring(0, i),
              tag: tag.substring(i + 4)
            }
          });
        etch.update(this);
      })
      .catch(err => {
        this.tags = [];
        console.log(err);
        etch.update(this);
      });
    etch.update(this);
  }

  updateStatus() {
    const process = new Process('status');
    process.execute()
      .then(status => {
        this.status = status;
        etch.update(this);
      })
      .catch(err => {
        this.status = err;
        etch.update(this);
      });
    etch.update(this);
  }

  import() {
    odv.checkVaultInitialized().then(initialized => {
      if (initialized) {
        const modal = new ImportModal();
        document.querySelector('atom-workspace.workspace').appendChild(modal.element);
      }
    });
  }

  export() {
    odv.checkVaultInitialized().then(initialized => {
      if (initialized) {
        const modal = new ExportModal();
        document.querySelector('atom-workspace.workspace').appendChild(modal.element);
      }
    });
  }

  update() {
    etch.update(this);
  }

  serialize() {
    return {
      deserializer: 'open-diabetes-filter/VaultView',
      initialized: this.initialized,
      tags: this.tags,
      status: this.status
    }
  }

  destroy() {
    this.watcher.dispose();
    return etch.destroy(this);
  }

  getTitle() {
    // Used by Atom for tab text
    return 'ODV Repository'
  }

  getURI() {
    // Used by Atom to identify the view when toggling.
    return 'atom://open-diabetes-vault';
  }

  getDefaultLocation() {
    return 'right';
  }

  getAllowedLocations() {
    return ['left', 'right'];
  }
}
