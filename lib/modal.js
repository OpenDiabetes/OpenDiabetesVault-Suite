'use babel';

/** @jsx etch.dom */

import etch from 'etch';

export default class Modal {
  constructor(properties, children) {
    this.properties = properties;
    this.children = children;
    etch.initialize(this);
  }

  render() {
    return (
      <div className="modal-outer">
        <atom-panel className="modal modal-inner" ref="panel">
          {this.children}
        </atom-panel>
      </div>
    );
  }

  getPanel() {
    return this.refs.panel;
  }

  destroy() {
    etch.destroy(this);
  }

  update() {
    etch.update(this);
  }
}
