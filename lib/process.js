const cp = require('child_process');
const Docker = require('dockerode');
const path = require('path');
const uuid = require('uuid/v4');
const {Writable} = require('stream');
const {StringDecoder} = require('string_decoder');
const {getProjectPath, getModulePath} = require('./util');

const MODE_DOCKER = 'docker';
const MODE_NATIVE = 'native';
const MODE_CUSTOM = 'custom';

const CLI = 'cli';
const JAVAC = 'javac';
const PLOT = 'plot';

const __running = {};

function disposeAll() {
  for (const process of Object.values(__running)) {
    process.dispose();
  }
}

// Docker

function isDockerEnabled(type) {
  switch (type) {
    case CLI:
    case JAVAC:
      return atom.config.get('open-diabetes-filter.cli.executable') === MODE_DOCKER;
    case PLOT:
      return atom.config.get('open-diabetes-filter.plot.executable') === MODE_DOCKER;
  }
}

/**
 * Creates a new Docker instance asynchronously. Remote Docker implementation commented out. `fs-extra` module needed.
 *
 * @returns {Promise<Docker>}
 */
function getDocker() {
  return Promise.resolve(new Docker());
  /* ======== Remote Docker ========
  return new Promise((resolve, reject) => {
    if (atom.config.get('open-diabetes-filter.docker.remote')) {
      // load tls files asynchronously
      const cert = fs.readFile(atom.config.get('open-diabetes-filter.docker.cert'));
      const key = fs.readFile(atom.config.get('open-diabetes-filter.docker.key'));
      let cacert;
      if (atom.config.get('open-diabetes-filter.docker.noca')) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        cacert = Promise.resolve(undefined);
      } else cacert = fs.readFile(atom.config.get('open-diabetes-filter.docker.cacert'));

      Promise.all([cert, key, cacert])
      // after all tls files are loaded
        .then(files => {
          const docker = new Docker({
            protocol: atom.config.get('open-diabetes-filter.docker.protocol'),
            host: atom.config.get('open-diabetes-filter.docker.host'),
            port: atom.config.get('open-diabetes-filter.docker.port'),
            cert: files.shift(),    // Promise.all resolves in same order as input array
            key: files.shift(),
            ca: files.shift()
          });
          console.log(docker);
          resolve(docker);
        })
        // error with tls files
        .catch(err => {
          console.error(err);
          reject(err);
        });

    } else {
      resolve(new Docker());
    }
  });
  */
}

// CLI

function getCli() {
  if (atom.config.get('open-diabetes-filter.cli.executable') === 'native')
    return path.resolve(getModulePath(), '..', 'bin', 'odv', 'OpenDiabetesVault.jar');
  else return atom.config.get('open-diabetes-filter.cli.custom');
}

function checkCli(silent) {
  new Process('version').execute()
    .then(() => {
      if (!silent) {
        atom.notifications.addSuccess('ODV CLI successfully found!');
      }
    })
    .catch(stderr => {
      const notification = atom.notifications.addWarning('Invalid CLI defined', {
        detail: stderr,
        dismissable: true,
        buttons: [{
          className: 'btn btn-warning',
          text: 'Open Settings',
          onDidClick: () => {
            atom.workspace.open('atom://config/packages/open-diabetes-filter');
            notification.dismiss();
          }
        }]
      });
    });
}

// Plot

function getPlot() {
  if (atom.config.get('open-diabetes-filter.plot.executable') === 'native')
    return path.resolve(getModulePath(), '..', 'bin', 'plotteria', 'plot.py');
  else return atom.config.get('open-diabetes-filter.plot.custom');
}

function getPlotConfig() {
  if (atom.config.get('open-diabetes-filter.plot.config-native'))
    return path.resolve(getModulePath(), '..', 'bin', 'plotteria', 'config.ini');
  return atom.config.get('open-diabetes-filter.plot.config');
}

function checkPlot(silent) {
  new Process('plotversion', {}, PLOT).execute()
    .then(() => {
      if (!silent) {
        atom.notifications.addSuccess('Plot generator successfully found!');
      }
    })
    .catch(stderr => {
      const notification = atom.notifications.addWarning('Invalid Plot executable defined', {
        detail: stderr,
        dismissable: true,
        buttons: [{
          className: 'btn btn-warning',
          text: 'Open Settings',
          onDidClick: () => {
            atom.workspace.open('atom://config/packages/open-diabetes-filter');
            notification.dismiss();
          }
        }]
      });
    });
}

/**
 * A class representing a process executing a command defined in the settings.
 * The process can be executed only once, using the `execute()` method.
 * It is possible to assign consumer functions to the `onstdout` and `onstderr` fields.
 */
class Process {
  /**
   * Creates a new Process. The process is not executed until the `execute()` method is called.
   * The process can be disposed using the `dispose()` method.
   *
   * @param {string} command Command defined in settings. Assumes `open-diabetes-filter.commands` namespace.
   * @param {Object} args Arguments object. Each key represents a variable which will be replaced with the value.
   * @param {string} type Type of the command. Constants defined in this module.
   */
  constructor(command, args = {}, type = CLI) {
    switch (type) {
      case CLI:
        if (atom.config.get('open-diabetes-filter.cli.executable') === MODE_DOCKER) {
          this.docker = true;
          this.docker_image = 'odv';
          args.java = 'java';
          args.cli = '/opt/odv/dist/OpenDiabetesVault.jar';
        } else {
          this.docker = false;
          args.java = atom.config.get('open-diabetes-filter.paths.java');
          args.cli = getCli();
        }
        break;
      case JAVAC:
        if (atom.config.get('open-diabetes-filter.cli.executable') === MODE_DOCKER) {
          this.docker = true;
          this.docker_image = 'odv';
          args.javac = 'javac';
          args.cli = '/opt/odv/dist/OpenDiabetesVault.jar';
        } else {
          this.docker = false;
          args.javac = atom.config.get('open-diabetes-filter.paths.javac');
          args.cli = getCli();
        }
        break;
      case PLOT:
        if (atom.config.get('open-diabetes-filter.plot.executable') === MODE_DOCKER) {
          this.docker = true;
          this.docker_image = 'plotteria';
          args.python = 'python';
          args.plot = '/tmp/plotteria/plot.py';
          args.config = '/tmp/plotteria/config.ini';
        } else {
          this.docker = false;
          args.python = atom.config.get('open-diabetes-filter.paths.python');
          args.plot = getPlot();
          args.config = getPlotConfig();
        }
        break;
    }

    // build command
    let cmd = buildCommand(command, args);

    // set up class values
    this.command = cmd;
    this.args = splitCommandArgs(cmd);
    this.stdout = '';
    this.stderr = '';
    this.binds = [
      getProjectPath() + ':/mnt/project'
    ];
    this.running = false;
    this.finished = false;
    this.disposed = false;
  }

  /**
   * Adds a bind for a docker container.
   *
   * @param {string} path path on the host
   * @param {string} target path in the container
   */
  addBind(path, target) {
    this.binds.push(path + ':' + target);
  }

  /**
   * Executes the process. Does nothing if this process was disposed using the `dispose()` method.
   * You can only execute this method once.
   *
   * @returns {Promise<string>} a promise that resolves with stdout or rejects with stderr
   * @throws {Error} if this process was executed already.
   */
  execute() {
    if (this.running)
      throw new Error('Process is already running');
    if (this.finished)
      throw new Error('Process did execute already');
    if (this.disposed)
      return Promise.reject('Process was disposed');

    this.running = true;
    this.id = uuid();
    __running[this.id] = this;

    return new Promise((resolve, reject) => {
      if (this.docker) {
        console.debug(`Running on Docker: ${this.command}`);
        // this.process is a promise that resolves with the docker container
        this.process = new Promise(container_resolve => {
          getDocker().then(docker => {
            docker.run(this.docker_image, this.args,
              [new StdoutWritable(this), new StderrWritable(this)],
              {
                Tty: false,
                HostConfig: {
                  Binds: this.binds,
                  AutoRemove: atom.config.get('open-diabetes-filter.docker.cleanup')
                },
                WorkingDir: '/mnt/project'
              }, {}, (err, data) => {
                this.running = false;
                delete __running[this.id];

                if (data && data.StatusCode === 0) {
                  this.finished = true;
                  resolve(this.stdout);
                } else reject(data ? this.stderr : err)
              })
              .on('container', container => {
                container_resolve(container);
              });
          }).catch(err => {
            atom.notifications.addError('Error while initiating docker!', {
              detail: err,
              dismissable: true
            });
          });
        });

      } else {
        console.debug(`Spawning process: ${this.command}`);
        const exec = this.args.shift();
        const args = Object.freeze(this.args);
        const process = cp.spawn(exec, args, {
          cwd: getProjectPath(),
          windowsHide: true
        });
        process.on('close', code => {
          this.running = false;
          delete __running[this.id];

          if (code === 0) {
            this.finished = true;
            resolve(this.stdout);
          } else reject(this.stderr);
        });
        process.stdout.on('data', chunk => {
          chunk = chunk.toString('utf8');
          this.stdout += chunk;
          if (typeof this.onstdout === 'function')
            this.onstdout(chunk);
        });
        process.stderr.on('data', chunk => {
          chunk = chunk.toString('utf8');
          this.stderr += chunk;
          if (typeof this.onstderr === 'function')
            this.onstderr(chunk);
        });

        // this.process is a promise that resolves with the ChildProcess object
        this.process = Promise.resolve(process);
      }
    })
  }

  /**
   * Disposes this process. Kills the process if it is already running.
   * Does nothing if the process did already finish or was disposed previously.
   */
  dispose() {
    if (this.disposed || this.finished)
      return;
    this.disposed = true;
    if (this.running) {
      this.process.then(prc => {
        // ChildProcess and Container both use the kill() method
        prc.kill();
      });
    }
  }
}


// commands

function buildCommand(command, arguments = {}) {
  let cmd = atom.config.get('open-diabetes-filter.commands.' + command);
  for (const [key, value] of Object.entries(arguments)) {
    cmd = cmd.replace('%' + key + '%', value);
  }
  return cmd;
}

/**
 * Splits a command by whitespace but keeps quoted parts together. Allows for escaped quotes.
 *
 * @param command command string
 * @param quotes set to true to keep quotes around arguments
 * @returns Array<string> array of arguments for this command. First argument will be the executable
 */
function splitCommandArgs(command, quotes = false) {
  let args = command.match(/[^"\s]+|"(?:\\"|[^"])+"/g);  // split the command by whitespace but keep quoted parts together. Allows for escaped quotes
  if (!quotes)      // remove quotes
    args = args.map(arg => arg.startsWith('"') && arg.endsWith('"') ? arg.substring(1, arg.length - 1) : arg);
  return args;
}

class StdoutWritable extends Writable {
  /**
   * @param {Process} process
   */
  constructor(process) {
    super();
    const state = this._writableState;
    this._decoder = new StringDecoder(state.defaultEncoding);
    this.data = '';
    this.process = process;
  }

  _write(chunk, encoding, callback) {
    if (encoding === 'buffer') {
      chunk = this._decoder.write(chunk);
    }
    this.data += chunk;
    callback();
    if (typeof this.process.onstdout === 'function')
      this.process.onstdout(chunk);
  }

  _final(callback) {
    this.data += this._decoder.end();
    this.process.stdout = this.data;
    callback();
  }
}

class StderrWritable extends Writable {
  /**
   * @param {Process} process
   */
  constructor(process) {
    super();
    const state = this._writableState;
    this._decoder = new StringDecoder(state.defaultEncoding);
    this.data = '';
    this.process = process;
  }

  _write(chunk, encoding, callback) {
    if (encoding === 'buffer') {
      chunk = this._decoder.write(chunk);
    }
    this.data += chunk;
    callback();
    if (typeof this.process.onstderr === 'function')
      this.process.onstderr(chunk);
  }

  _final(callback) {
    this.data += this._decoder.end();
    this.process.stderr = this.data;
    callback();
  }
}

module.exports = {
  MODE_DOCKER, MODE_NATIVE, MODE_CUSTOM,
  CLI, JAVAC, PLOT,
  isDockerEnabled, checkCli, checkPlot,
  disposeAll, Process
};
