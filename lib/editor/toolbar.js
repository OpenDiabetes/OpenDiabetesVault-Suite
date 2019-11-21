'use babel';

/** @jsx etch.dom */

import etch from 'etch';
import odv from '../odv';
import ExecuteModal from './execute-modal';

export default class Toolbar {
  saved = true;

  constructor(editor) {
    this.editor = editor;
    etch.initialize(this);
  }

  render() {
    return (
      <div className="odf-toolbar block">
        <div className="btn-group inline-block">
          <button className="btn btn-info icon icon-desktop-download" disabled={this.saved}
                  title={this.saved ? "All changes saved" : "Save"} on={{click: this.save}}/>
          <button className="btn btn-info icon icon-chevron-down" title="Save as..." on={{click: this.saveAs}}/>
        </div>
        <button className="btn btn-success inline-block" on={{click: this.execute}} title="Execute filters">
          <span className="icon-left icon-playback-play"/>Run
        </button>
      </div>
    );
  }

  save() {
    this.editor.save();
  }

  saveAs() {
    this.editor.saveAs();
  }

  execute() {
    odv.checkVaultInitialized().then(initialized => {
      if (initialized) {
        const modal = new ExecuteModal(this.editor);
        document.querySelector('atom-workspace.workspace').appendChild(modal.element);
      }
    });
  }

  setSaved(saved) {
    this.saved = saved;
    etch.update(this);
  }

  update() {
    etch.update(this);
  }
}
