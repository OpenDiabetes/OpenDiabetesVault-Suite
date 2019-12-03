'use babel';

/** @jsx etch.dom */

import etch from 'etch';
import SaveModal from "./save-modal";

export default class SliceLabel {
  constructor(properties) {
    this.plot = properties.plot;
    this.labels = properties.labels;
    this.currentSlice = properties.currentSlice;
    this.tag = properties.tag;

    etch.initialize(this);
  }

  render() {
    return (
      <div className="native-key-bindings" style="max-width: 400px; margin-left: 5px">
        <h2 className="mb-1">Label Slice</h2>
        <div className="mb-1">What name should this label get?</div>
        <SliceLabelInput ref="label" label={this} value={this.currentSlice.label} labels={this.labels}/>
        <div className="mb-1">Start of Slice: <strong>{this.currentSlice.timestamp}</strong></div>
        <div className="mb-1">Duration: <strong>{this.currentSlice.duration}</strong> minutes</div>
        <button className="btn btn-warning" on={{click: this.save}}>Save Labels</button>
      </div>
    );
  }

  setLabel(label) {
    this.plot.labelCurrentSlice(label);
  }

  save() {
    const modal = new SaveModal(this.plot, this.tag);
    this.element.appendChild(modal.element);
  }

  update(properties) {
    this.plot = properties.plot;
    this.labels = properties.labels;
    this.currentSlice = properties.currentSlice;
    this.tag = properties.tag;
    etch.update(this);
  }

  destroy() {
    etch.destroy(this);
  }
}

class SliceLabelInput {
  constructor(properties) {
    this.label = properties.label;
    this.value = properties.value;
    this.labels = properties.labels;
    etch.initialize(this);
  }

  render() {
    const items = this.labels.map(label => <SliceLabelItem input={this} label={label}/>);
    return (
      <div ref="div">
        <input ref="input" className="input-text mb-1" type="text" placeholder="Name" value={this.value}
               on={{focus: this.openList, blur: this.closeList, input: this.input}}/>
        <div className="tag-list" ref="list">
          <ol className="list-group">
            {items}
          </ol>
        </div>
      </div>
    );
  }

  openList() {
    // set width of dropdown a little bit smaller then total width
    const width = this.element.offsetWidth - 20;
    this.refs.list.style.marginLeft = '10px';
    this.refs.list.style.width = width + 'px';
    this.refs.list.style.display = 'block';
  }

  closeList(event) {
    // this is executed as soon as the focus is taken off of the input
    // set timeout to allow for clicks on the actual list items to occur
    setTimeout(() => {
      if (document.activeElement !== event.target) {
        this.refs.list.style.display = 'none';
      }
    }, 100);
  }

  input() {
    this.label.setLabel(this.refs.input.value);
  }

  setLabel(label, callback = true) {
    this.refs.input.value = label;
    if (callback)
      this.label.setLabel(label);
  }

  update(properties) {
    this.label = properties.label;
    this.value = properties.value;
    this.labels = properties.labels;
    etch.update(this).then(() => this.refs.input.value = this.value);
  }
}

class SliceLabelItem {
  constructor(properties) {
    this.input = properties.input;
    this.label = properties.label;
    etch.initialize(this);
  }

  render() {
    return <li on={{mousedown: this.select}}>{this.label}</li>
  }

  select() {
    this.input.setLabel(this.label);
  }

  update(properties) {
    this.label = properties.label;
    etch.update(this);
  }
}
