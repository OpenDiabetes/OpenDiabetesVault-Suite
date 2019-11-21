'use babel';

/** @jsx etch.dom */

import etch from 'etch';
import path from 'path';
import LRU from 'lru-cache';

const pdf = require('pdfjs-dist');

const cache = new LRU({
  max: atom.config.get('open-diabetes-filter.plot.cache-maxsize'),
});

function ensureCached(url) {
  if (cache.has(url))
    return;
  loadPdf(url);
}

/**
 * Loads the pdf with the given path and puts the loading promise in the cache
 * @param url url of pdf
 */
function loadPdf(url) {
  if (!cache.has(url)) {
    cache.set(url, pdf.getDocument(url).then(doc => {
      // doc.getPage() returns a promise that resolves when the page is loaded.
      return doc.getPage(1);
    }).catch(err => {
      console.error(err);
      atom.notifications.addError(err.name, {
        detail: err.message,
        dismissable: true
      });
    }));
  }
  return cache.get(url);
}

class Canvas {
  constructor(properties) {
    this.scale = properties.scale;
    this.url = properties.url;
    this.labels = properties.labels;
    etch.initialize(this);
    this.renderPdf();
  }

  render() {
    const url = this.url ? path.basename(this.url) : '';
    return (
      <div className="plot-canvas">
        <canvas ref="canvas" width={0} height={0}/>
        <div className={this.labels ? 'canvas-url-selected' : 'canvas-url'}>{url}</div>
      </div>
    );
  }

  /**
   * Renders the pdf. Loads the pdf if necessary
   */
  renderPdf() {
    if (this.url) {
      loadPdf(this.url).then(page => {
        const viewport = page.getViewport(this.scale);   // method signature does not match documentation, documented use would be `getViewport({scale: 1.0})`
        const canvas = this.refs.canvas;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        const ctx = canvas.getContext('2d');
        page.render({
          canvasContext: ctx,
          viewport: viewport
        });
      }).catch(err => {
        console.error(err);
        atom.notifications.addError(err.name, {
          detail: err.message
        });
        // remove from cache on error, to try loading it again later
        cache.del(this.url);
      });
    } else {
      const canvas = this.refs.canvas;
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  update(properties) {
    const update = this.url !== properties.url || this.scale !== properties.scale;
    this.scale = properties.scale;
    this.url = properties.url;
    this.labels = properties.labels;
    etch.update(this).then(() => {
      if (update)
        this.renderPdf();
    });
  }

  destroy() {
    etch.destroy(this);
  }
}

module.exports = {
  Canvas,
  ensureCached
};
