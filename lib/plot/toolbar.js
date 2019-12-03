'use babel';

/** @jsx etch.dom */

import etch from 'etch';
import TagInput from '../tag-input';
import {VIEW_BIG, VIEW_DAILY, VIEW_NORMAL, VIEW_TINY} from './view-size';

export default class Toolbar {
  progressMessage = '';
  pageInput = false;

  constructor(properties) {
    this.plot = properties.plot;
    this.tag = properties.tag;
    this.currentPage = properties.currentPage;
    this.maxPage = properties.maxPage;
    this.view = properties.view;
    this.labels = properties.labels;
    this.inProgress = properties.inProgress;

    etch.initialize(this);

    this.refs.tag.onupdate = tag => this.plot.setTag(tag);
  }

  render() {
    const page = [];
    if (this.pageInput) {
      page.push(
        <div className="btn btn-info btn-dummy native-key-bindings">
          <input className="input-number input-page" type="number" min={1} max={this.maxPage} value={this.currentPage}
                 on={{keyup: this.closePageInput, blur: this.tryClosePageInput}} ref="pageInput"/> / {this.maxPage}
        </div>
      );
    } else {
      page.push(
        <button className="btn btn-info" on={{click: this.openPageInput}} disabled={this.maxPage === 0}>
          {this.currentPage} / {this.maxPage}
        </button>
      );
    }

    const progress = [];
    if (this.inProgress) {
      progress.push(<progress className="inline-block"/>);
      progress.push(<span className="inline-block">{this.progressMessage}</span>);
    }

    return (
      <div className="odf-toolbar block">
        <TagInput ref="tag" value={this.tag} title="Choose tag for export, leave empty for all data" disabled={this.inProgress}/>
        <div className="btn-group inline-block">
          <button className="btn btn-info" on={{click: this.prev}} title="Previous plot"
                  disabled={this.currentPage === 1 || this.maxPage === 0}><span className="icon-jump-left"/></button>
          {page}
          <button className="btn btn-info" on={{click: this.next}} title="Next plot"
                  disabled={this.currentPage === this.maxPage || this.maxPage === 0}><span className="icon-jump-right"/></button>
        </div>
        <div className="btn-group inline-block">
          <button className="btn icon icon-plus" on={{click: this.zoomIn}} title="Zoom In" disabled={this.maxPage === 0}/>
          <button className="btn icon icon-dash" on={{click: this.zoomOut}} title="Zoom Out" disabled={this.maxPage === 0}/>
        </div>
        <div className="btn-group inline-block">
          <button className={'btn icon icon-versions' + (this.view === VIEW_DAILY ? ' selected' : '')}
                  on={{click: this.setViewAll}} title="Daily Plots"/>
          <button className={'btn icon-xs icon-text-size' + (this.view === VIEW_TINY ? ' selected' : '')}
                  on={{click: this.setViewTiny}} title="Tiny Slices" disabled={!this.tag}/>
          <button className={'btn icon-s icon-text-size' + (this.view === VIEW_NORMAL ? ' selected' : '')}
                  on={{click: this.setViewNormal}} title="Normal Slices" disabled={!this.tag}/>
          <button className={'btn icon-m icon-text-size' + (this.view === VIEW_BIG ? ' selected' : '')}
                  on={{click: this.setViewBig}} title="Big Slices" disabled={!this.tag}/>
        </div>
        <button className="btn btn-warning icon icon-checklist inline-block" title="Toggle Labels"
                on={{click: this.toggleLabel}} disabled={this.view === VIEW_DAILY}/>
        <div className="btn-group inline-block">
          <button className="btn btn-success icon icon-repo-sync" on={{click: this.updateBtn}} disabled={this.inProgress}
                  title="Generate plots for the currently selected tag"/>
          <button className="btn btn-error icon icon-primitive-square" on={{click: this.cancelBtn}} disabled={!this.inProgress}
                  title="Cancel plot generation"/>
          <button className="btn btn-error icon icon-trashcan" on={{click: this.deleteBtn}}
                  disabled={this.inProgress || this.maxPage === 0} title="Delete all generated plots for this tag"/>
        </div>
        {progress}
      </div>
    );
  }

  updateProgress(message) {
    this.progressMessage = message;
    etch.update(this);
  }

  next() {
    this.plot.nextPage();
  }

  prev() {
    this.plot.prevPage();
  }

  openPageInput() {
    this.pageInput = true;
    etch.update(this).then(() => this.refs.pageInput.focus());
  }

  closePageInput(event) {
    if (!this.pageInput)
      return;
    if (event.key !== 'Enter')
      return;

    let number = event.target.value;
    if (isNaN(number))
      return;

    number = parseInt(number);
    if (number >= 1 && number <= this.maxPage) {
      this.pageInput = false;
      this.plot.setPage(number);
      etch.update(this);
    }
  }

  tryClosePageInput(event) {
    if (!this.pageInput)
      return;
    let number = event.target.value;
    if (isNaN(number))
      return;

    number = parseInt(number);
    this.pageInput = false;
    this.plot.setPage(number);
    etch.update(this);
  }

  zoomIn() {
    this.plot.zoomIn();
  }

  zoomOut() {
    this.plot.zoomOut();
  }

  setViewAll() {
    this.plot.setViewSize(VIEW_DAILY);
  }

  setViewTiny() {
    this.plot.setViewSize(VIEW_TINY);
  }

  setViewNormal() {
    this.plot.setViewSize(VIEW_NORMAL);
  }

  setViewBig() {
    this.plot.setViewSize(VIEW_BIG);
  }

  toggleLabel() {
    this.plot.toggleLabels();
  }

  updateBtn() {
    this.plot.updatePlots();
  }

  cancelBtn() {
    this.plot.cancelPlots();
  }

  deleteBtn() {
    this.plot.deletePlots();
  }

  update(properties) {
    this.plot = properties.plot;
    this.tag = properties.tag;
    this.currentPage = properties.currentPage;
    this.maxPage = properties.maxPage;
    this.view = properties.view;
    this.labels = properties.labels;
    this.inProgress = properties.inProgress;
    etch.update(this);
  }

  destroy() {
    etch.destroy(this);
  }
}
