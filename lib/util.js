const path = require('path');

function hasProjectDirectory() {
  return atom.project.getPaths().length > 0;
}

function checkProjectDirectory() {
  if (hasProjectDirectory())
    return true;
  const notification = atom.notifications.addWarning('No Project opened!', {
    description: 'You don\'t have any project directory opened.',
    dismissable: true,
    buttons: [{
      className: 'btn btn-warning',
      text: 'Open Project Directory',
      onDidClick: () => {
        atom.pickFolder(paths => {
          if (paths) {
            notification.dismiss();
            for (const path of paths) {
              atom.project.addPath(path, {
                mustExists: true,
                exact: true
              });
            }
          }
        })
      }
    }]
  });
  return false;
}

function getProjectPath() {
  return atom.project.getPaths()[0];
}

function getModulePath() {
  return path.dirname(atom.packages.loadedPackages['open-diabetes-filter']['mainModulePath']);
}

/**
 * Returns the relative path from the current project to the given file. Used for commands executed in docker
 *
 * @param file Atom File object
 * @returns string relative path to the file
 */
function getRelativeProjectPath(file) {
  return atom.project.relativizePath(file)[1];
}

/**
 * Given a set of strings representing directory paths, will return a string representing that part of the directory tree that is common to all the directories.
 * @param input {array} set of paths
 * @param sep {string} single character directory separator
 * @returns {string} the common path
 */
function findCommonPath(input, sep = path.sep) {
  /**
   * Given an array of strings, return an array of arrays, containing the
   * strings split at the given separator
   * @param {!Array<!string>} a
   * @returns {!Array<!Array<string>>}
   */
  const splitStrings = a => a.map(i => i.split(sep));

  /**
   * Given an index number, return a function that takes an array and returns the
   * element at the given index
   * @param {number} i
   * @return {function(!Array<*>): *}
   */
  const elAt = i => a => a[i];

  /**
   * Transpose an array of arrays:
   * Example:
   * [['a', 'b', 'c'], ['A', 'B', 'C'], [1, 2, 3]] ->
   * [['a', 'A', 1], ['b', 'B', 2], ['c', 'C', 3]]
   * @param {!Array<!Array<*>>} a
   * @return {!Array<!Array<*>>}
   */
  const rotate = a => a[0].map((e, i) => a.map(elAt(i)));

  /**
   * Checks of all the elements in the array are the same.
   * @param {!Array<*>} arr
   * @return {boolean}
   */
  const allElementsEqual = arr => arr.every(e => e === arr[0]);

  return rotate(splitStrings(input)).filter(allElementsEqual).map(elAt(0)).join(sep);
}

// array stuff

function isUnique(value, index, self) {
  return self.indexOf(value) === index;
}

module.exports = {
  hasProjectDirectory, checkProjectDirectory, getProjectPath, getModulePath, getRelativeProjectPath, findCommonPath,
  isUnique
};
