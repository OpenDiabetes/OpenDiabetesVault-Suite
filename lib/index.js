'use babel';

import {CompositeDisposable, Disposable} from 'atom';
import {js2xml} from 'xml-js';
import path from 'path';
import etch from 'etch';
import util from './util';
import process from './process';
import odv from './odv';
import tagCache from './tag-cache';
import EditorView from './editor/editor-view';
import PlotView from './plot/plot-view';
import VaultView from './vault/vault-view';

export default {

  subscriptions: null,

  activate(state) {
    if (state)
      tagCache.setCache(state);

    this.subscriptions = new CompositeDisposable(
      // Add an opener for the views
      atom.workspace.addOpener(uri => {
        if (uri.endsWith('.odf')) {
          // all .odf files are opened directly
          return new EditorView(null, uri, null, null)
        } else if (uri === 'atom://open-diabetes-filter') {
          // open new ODF editor
          return new EditorView();
        } else if (uri.startsWith('atom://open-diabetes-plot')) {
          // plot views
          let id = uri.match(/atom:\/\/open-diabetes-plot(\/[\w-]+)?/);
          if (!Array.isArray(id) || id.length < 2 || !id[1])
            id = null;
          else id = id[1].substring(1);
          return new PlotView(id);
        } else if (uri === 'atom://open-diabetes-vault') {
          return new VaultView();
        }
      }),

      // Register commands
      atom.commands.add('atom-workspace', {
        'open-diabetes-filter:check-settings': () => this.checkSettings(false),
        'open-diabetes-filter:editor': () => atom.workspace.open('atom://open-diabetes-filter'),
        'open-diabetes-filter:initialize-repository': () => odv.initializeVault(),
        'open-diabetes-filter:plot': () => atom.workspace.open('atom://open-diabetes-plot'),
        'open-diabetes-filter:settings': () => atom.workspace.open('atom://config/packages/open-diabetes-filter'),
        'open-diabetes-filter:vault': () => atom.workspace.open('atom://open-diabetes-vault')
      }),

      // Destroy any Views when the package is deactivated
      new Disposable(() => {
        atom.workspace.getCenter().getPaneItems().forEach(item => {
          if (item instanceof EditorView || item instanceof PlotView || item instanceof VaultView) {
            item.destroy();
          }
        });
      }),

      // Kill all processes when the package is deactivated
      new Disposable(() => process.disposeAll())
    );

    // coordinate etch's DOM interactions with atom
    etch.setScheduler(atom.views);

    this.loadBlockly();

    // check settings
    setTimeout(() => this.checkSettings(true), 1000);
  },

  checkSettings(silent) {
    process.checkCli(silent);
    process.checkPlot(silent);
  },

  /**
   * Loads Blockly scripts and injects Blockly into existing editors
   */
  loadBlockly() {
    const blocklyPath = path.join(util.getModulePath(), 'google-blockly');
    Promise.all([
      // Load Blockly in sequence
      [
        path.join(blocklyPath, 'blockly_compressed.js'),
        path.join(blocklyPath, 'msg', 'js', 'en.js'),
        path.join(blocklyPath, 'blocks_compressed.js'),
        path.join(blocklyPath, 'generators', 'odf.js')
      ].reduce((sequence, url) => {
        return sequence.then(() => {
          return this.loadScript(url);
        });
      }, Promise.resolve()),
      // Load toolbox
      this.getResource(path.join(blocklyPath, 'toolbox.xml')),
      this.getResource(path.join(blocklyPath, 'startblocks.xml')),
      // Load blocks
      this.getResource(path.join(blocklyPath, 'blocks', 'main.json')),
      this.getResource(path.join(blocklyPath, 'blocks', 'values.json')),
      this.getResource(path.join(blocklyPath, 'blocks', 'filters.json'))
    ]).then((results) => {
      // After all resources are loaded initialize Blockly
      // Blockly
      results.shift();
      // toolbox
      const toolbox = results.shift();
      const startblocks = results.shift();
      // blocks
      let block;
      while ((block = results.shift()) !== undefined) {
        block = JSON.parse(block);
        if (Array.isArray(block)) {
          block.forEach(loadBlock);
        } else loadBlock(block);
      }

      function loadBlock(block) {
        Blockly.Blocks[block.type] = {
          init: function () {
            this.jsonInit(block);
          }
        }
      }

      console.log('Successfully loaded Blockly.');

      // inject into editors
      for (const item of atom.workspace.getCenter().getPaneItems()) {
        if (item instanceof EditorView) {
          // check that the item is actually attached to the DOM
          if (!item.blockly_injected && document.body.contains(item.getElement()))
            this.injectBlockly(item, toolbox, startblocks);
          // resize if it is injected
          if (item.blockly_injected)
            this.resizeBlockly(item);
        }
      }

      // listen for future editors
      this.subscriptions.add(atom.workspace.getCenter().onDidStopChangingActivePaneItem(item => {
        if (item instanceof EditorView && !item.blockly_injected)
          this.injectBlockly(item, toolbox, startblocks);
        // always resize all editors as they may be visible but not active
        this.resizeAllBlockly()
      }));

      // resize on window resize
      window.addEventListener('resize', () => this.resizeAllBlockly(), false);
      // remove listener on disable
      this.subscriptions.add(new Disposable(() => {
        window.removeEventListener('resize', () => this.resizeAllBlockly(), false);
      }));

      // listen for Blockly inputs
      window.addEventListener('DOMNodeInserted', e => this.injectNativeKeybindings(e), false);
      // remove listener on disable
      this.subscriptions.add(new Disposable(() => {
        window.removeEventListener('DOMNodeInserted', e => this.injectNativeKeybindings(e), false);
      }));
    }).catch((error) => {
      // Log any errors that occurred
      console.error(error)
    });
  },

  /**
   * Injects blockly into an editor
   * @param editor {EditorView} the editor view
   * @param toolbox {string} Toolbox XML
   * @param startblocks {string} Starting blocks XML
   */
  injectBlockly(editor, toolbox, startblocks) {
    editor.workspace = Blockly.inject(editor.div, {
      toolbox: toolbox
    });

    if (editor.serialized) {
      Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(editor.serialized), editor.workspace);
    } else Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(startblocks), editor.workspace);
    editor.workspace.registerButtonCallback('createVariable', () => {
      Blockly.Variables.createVariableButtonHandler(editor.workspace)
    });
    editor.workspace.addChangeListener(event => editor.onWorkspaceChange(event));
    editor.blockly_injected = true;
    editor.blockly_resolve();
  },

  /**
   * Resizes all blockly editors
   */
  resizeAllBlockly() {
    for (const item of atom.workspace.getCenter().getPaneItems()) {
      if (item instanceof EditorView && item.blockly_injected) {
        this.resizeBlockly(item);
      }
    }
  },

  /**
   * Resizes the editor
   * @param editor {EditorView} the editor view
   */
  resizeBlockly(editor) {
    editor.div.style.width = editor.area.offsetWidth + 'px';
    editor.div.style.height = editor.area.offsetHeight + 'px';
    Blockly.svgResize(editor.workspace);
  },

  /**
   * Loads a script and appends it to the body of the document
   *
   * @param url location of the script
   * @returns {Promise<HTMLScriptElement>} the loaded script element
   */
  loadScript(url) {
    return new Promise((resolve, reject) => {
      console.log(`Loading script from ${url}...`);
      const script = document.createElement('script');
      script.classList.add('blocklyScript');
      script.src = url;
      script.onload = () => {
        resolve(script);
      };
      script.onerror = () => {
        reject(Error('System error'));
      };
      document.body.appendChild(script);
    });
  },

  /**
   * Sends a HTTP GET request to the given URL
   *
   * @param url location to send the request to
   * @returns {Promise<string>} the contests of the requested resource
   */
  getResource(url) {
    return new Promise((resolve, reject) => {
      console.log(`Loading resource from ${url}...`);
      const req = new XMLHttpRequest();
      req.open('GET', url);
      req.onload = () => {
        if (req.status === 200)
          resolve(req.responseText);
        else reject(Error(req.statusText));
      };
      req.onerror = () => {
        reject(Error('System error'));
      };
      req.send();
    });
  },

  /**
   * Injects the native-key-bindings class into all Blockly inputs
   * @param event a DOMNodeInserted event
   */
  injectNativeKeybindings(event) {
    if (event.target.constructor.name !== 'HTMLInputElement')
      return;
    const input = event.target;
    if (input.classList.contains('blocklyHtmlInput'))
      input.classList.add('native-key-bindings')
  },

  /**
   * Invoked by atom to deserialize editor views
   *
   * @param state serialized state of the editor
   * @returns {EditorView} new editor view with the serialized contents
   */
  deserializeEditor(state) {
    let workspace;
    if (state.workspace !== undefined)
      workspace = js2xml(state.workspace);
    return new EditorView(workspace, state.file, state.tagIn, state.tagOut);
  },

  /**
   * Invoked by atom to deserialize plot views
   *
   * @param state serialized state of the editor
   * @returns {PlotView} new plot view with the serialized contents
   */
  deserializePlot(state) {
    return new PlotView(state);
  },

  deserializeVault(state) {
    return new VaultView(state);
  },

  serialize() {
    return tagCache.getCache();
  },

  deactivate() {
    this.subscriptions.dispose();
  }
};
