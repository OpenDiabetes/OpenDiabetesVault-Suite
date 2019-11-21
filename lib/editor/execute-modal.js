'use babel';

/** @jsx etch.dom */

import {File} from 'atom';
import etch from 'etch';
import path from 'path';
const slash = require('slash');
import Modal from '../modal'
import util from '../util';
import {JAVAC, MODE_DOCKER, Process} from '../process';
import TagInput from "../tag-input";

export default class ExecuteModal {
  inProgress = false;

  constructor(editor) {
    this.editor = editor;
    etch.initialize(this);
  }

  render() {
    return (
      <Modal ref="modal">
        <h2 className="modal-title">Execute Filters</h2>
        <TagInput ref="tagIn" title="Input Tag" name="-in"/>
        <TagInput ref="tagOut" title="Output Tag" name="-out"/>
        <div className="text-error" ref="error"/>
        <button className="btn inline-block-tight btn-modal btn-success" ref="runbutton" on={{click: this.execute}}>
          <span className="icon-left icon-playback-play"/>Run
        </button>
        <button className="btn inline-block-tight btn-modal" ref="closebutton" on={{click: this.close}}>
          Close
        </button>
        <div className="process-output" ref="output"/>
      </Modal>
    );
  }

  execute() {
    const tagOut = this.getTagOut();
    if (!tagOut) {
      this.refs.error.innerHTML = 'Please specify an output tag!';
      return;
    }
    this.refs.error.innerHTML = '';
    this.refs.runbutton.setAttribute('disabled', true);
    this.refs.closebutton.setAttribute('disabled', true);

    this.editor.save().then(() => {
      const tagIn = this.getTagIn();
      const file = new File(path.join(util.getProjectPath(), 'filter', 'Process.java'));
      this.addLog('Writing file...', 'text-subtle');
      file.write(this.editor.output.code)
        .then(() => {
          const compile = atom.config.get('open-diabetes-filter.cli.precompile');
          if (compile) {
            this.addLog('Compiling filters...', 'text-subtle');
            // if docker is enabled, paths need to be posix style
            let args;
            if (atom.config.get('open-diabetes-filter.cli.executable') === MODE_DOCKER)
              args = {file: slash(util.getRelativeProjectPath(file.getPath()))};
            else args = {file: util.getRelativeProjectPath(file.getPath())};
            // compile
            const compile = new Process('compile', args, JAVAC);
            // if compile, return promise for compilation command and change file name to .class
            return compile.execute().then(() => Promise.resolve(file.getPath().replace('.java', '.class')));
            // else return .java file name
          } else return Promise.resolve(file.getPath());
        })
        .then(file => {
          this.addLog('Processing filters...', 'text-subtle');
          // if docker is enabled, paths need to be posix style
          if (atom.config.get('open-diabetes-filter.cli.executable') === MODE_DOCKER)
            file = slash(util.getRelativeProjectPath(file));
          else file = util.getRelativeProjectPath(file);

          let process;
          if (tagIn) {
            process = new Process('processtagged', {
              file: file,
              in: tagIn,
              out: tagOut
            });
          } else {
            process = new Process('process', {
              file: file,
              out: tagOut
            });
          }
          process.onstdout = stdout => {
            this.addLog(stdout);
            etch.update(this);
          };
          process.onstderr = stderr => {
            this.addLog(stderr, 'text-error');
            etch.update(this);
          };
          return process.execute();
        })
        .then(() => {
          this.refs.closebutton.removeAttribute('disabled');
          etch.update(this);
        })
        .catch(() => {
          this.refs.closebutton.removeAttribute('disabled');
          etch.update(this);
        });
    });
  }

  addLog(text, color = 'text-highlight') {
    const output = this.refs.output;
    const msg = document.createElement('div');
    msg.classList.add(color);
    msg.innerHTML = text;
    output.appendChild(msg);
    output.scrollTop = output.scrollHeight;
  }

  getTagIn() {
    return this.refs.tagIn.getTag();
  }

  getTagOut() {
    return this.refs.tagOut.getTag();
  }

  close() {
    this.refs.modal.destroy()
  }

  update(properties, children) {
    console.log(properties);
    console.log(children);
    etch.update(this);
  }
}
