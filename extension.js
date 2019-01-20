// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
let { workspace } = vscode;
const fs = require('fs-then');
const { resolve } = require('path');
const gitUser = require('git-user-name');
// Default timeout is set to 1 minute || 60 seconds
let timeout = 60;
let time = 0;
let currentFile;
let projectRoot;
let bool = false;
/**
 *
 * @param {Number} num
 */
function pad(num) {
  return ('0' + num).slice(-2);
}

/**
 * @description Take a number of seconds and return it in HH:mm:ss format
 * @param {Number} secs
 */
function hhmmss(secs) {
  var minutes = Math.floor(secs / 60);
  secs = secs % 60;
  var hours = Math.floor(minutes / 60);
  minutes = minutes % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  // return pad(hours)+":"+pad(minutes)+":"+pad(secs); for old browsers
}

function runCheckFiles(dir, defaultJson) {
  dir = resolve(dir, '.timelog');
  let logs = resolve(dir, gitUser().toLowerCase());

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  if (!fs.existsSync(logs)) {
    fs.mkdirSync(logs);
  }
  if (!fs.existsSync(resolve(logs, 'index.json'))) {
    fs.writeFile(
      resolve(logs, 'index.json'),
      JSON.stringify(defaultJson),
      'utf-8',
      (err, data) => {
        if (err) throw err;
        vscode.window.showInformationMessage(
          `Created log file for user ${gitUser()}`
        );
      }
    );
  }
}

function getRootFolder(folder) {
  if (
    fs.existsSync(resolve(folder, 'node_modules')) &&
    fs.existsSync(resolve(folder, 'package.json'))
  ) {
    projectRoot = folder;
    return folder;
  } else {
    let arr = folder.split('\\');
    if (arr.length > 1) {
      arr.pop();
      return getRootFolder(arr.join('/'));
    }
    arr = folder.split('/');
    if (arr.length > 1) {
      arr.pop();
      return getRootFolder(arr.join('/'));
    }
  }
}

function fileChanged(file) {
  // The user has changed to a different file, start logging time there instead
  if (file.includes('.timelog')) return;
  currentFile = file;
}

function relativePathFromFile() {
  if (!currentFile || currentFile == '') return;
  let arr = currentFile.split('\\');
  arr.pop();
  currentFile = arr.join('\\');
  let project = projectRoot || getRootFolder(currentFile);
  return {
    relativePathFromFile: resolve(currentFile)
      .replace(resolve(project), '')
      .split('\\')
      .join('/'),
    project
  };
}

function getJSONFromFile() {
  let { filePathRelativeToProject, project } = relativePathFromFile();
  let p = filePathRelativeToProject;
  let jsonPath = resolve(
    project,
    '.timelog',
    gitUser().toLowerCase(),
    'index.json'
  );
  return require(jsonPath);
}

function addTime(time) {
  if (!currentFile || currentFile == '') return;
  let { filePathRelativeToProject, project } = relativePathFromFile();
  let p = filePathRelativeToProject;
  let jsonPath = resolve(
    project,
    '.timelog',
    gitUser().toLowerCase(),
    'index.json'
  );
  let json = require(jsonPath);
  if (!json[p]) {
    json[p] = {};
  }
  let fileData = json[p];
  let date = new Date().toDateString();
  if (!fileData[date]) {
    fileData[date] = {
      seconds: 0
    };
  }
  fileData[date].seconds += 5;
  time = fileData[date].seconds;
  fs.writeFile(jsonPath, JSON.stringify(json), 'utf-8', (err, data) => {
    if (err) console.error(err);
  });
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "time-logger" is now active!',
    gitUser()
  );
  let dir = resolve(__dirname, '.timelog');
  let defaultJson = {};

  workspace.onDidChangeTextDocument(event => {
    let file = event.document.fileName;
    if (file !== currentFile) {
      fileChanged(file);
    }
    if (!projectRoot) {
      let arr = event.document.fileName.split('\\');
      arr.pop();
      arr = arr.join('\\');
      runCheckFiles(getRootFolder(arr), {});
    }

    if (timeout <= -5) {
      timeout = 60;
      let { filePathRelativeToProject, project } = relativePathFromFile();
      let json = getJSONFromFile();
      vscode.window.showInformationMessage(
        `Current time ${hhmmss(
          json[filePathRelativeToProject][new Date().toDateString()].seconds
        )} | No longer AFK`
      );
    }
  });

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    'extension.checkTime',
    function() {
      if (!relativePathFromFile()) {
        return vscode.window.showErrorMessage(`No File Selected`);
      }
      let { filePathRelativeToProject, project } = relativePathFromFile();
      console.log('--------');
      let json = getJSONFromFile();

      console.log(
        'JSON',
        json,
        filePathRelativeToProject,
        json[filePathRelativeToProject]
      );

      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      console.log(json, filePathRelativeToProject);
      console.log(json[filePathRelativeToProject]);
      console.log(json[filePathRelativeToProject][new Date().toDateString()]);
      vscode.window.showInformationMessage(
        `Current time spent on file today ${hhmmss(
          json[filePathRelativeToProject][new Date().toDateString()].seconds
        )}`
      );
    }
  );

  let notifications = vscode.commands.registerCommand(
    'extension.toggleNotifications',
    () => {
      bool = !bool;
      if (bool) {
        vscode.window.showInformationMessage(`Notifications Enabled!`);
      } else {
        vscode.window.showInformationMessage(`Notifications Disabled!`);
      }
    }
  );

  setInterval(() => {
    if (timeout > 0) {
      timeout -= 5;
      addTime(5);
    } else if (timeout <= 0 && timeout > -5) {
      timeout -= 5;
      vscode.window.showInformationMessage(
        `Current time ${hhmmss(time)} | Now AFK`
      );
    }
  }, 5000);

  context.subscriptions.push(disposable);
  context.subscriptions.push(notifications);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate
};
