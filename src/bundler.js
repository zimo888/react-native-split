/**
 * Created by desmond on 4/16/17.
 * @flow
 */
'use strict';
const exec = require('child_process').exec;
const path = require('path');
const fs = require('fs');
const Util = require('./utils');
const UglifyJS = require('uglify-js');

import type { Config } from '../flow/types';

type Callback = (err ?: any, data?: string) => void;

const DEV_REGEX = /global\.__DEV__\s?=\s?true/;
const DEV_FALSE = 'global.__DEV__ = false';

function injectCodesToBase(config: Config) {
  let entryInject = '\n\nrequire(\'AppRegistry\')\n';
  config.customEntries.forEach(entry => {
    if (entry.inject === false) {
      return;
    }
    let indexModule = path.resolve(config.root, entry.index);
    entryInject += 'require(\'' + indexModule + '\');\n';
  });
  let tmpEntry = path.resolve(config.root, config.baseEntry.index + '.tmp');
  if (fs.existsSync(tmpEntry)) {
    fs.unlinkSync(tmpEntry);
  }
  let originData = fs.readFileSync(config.baseEntry.index, 'utf-8');
  originData += entryInject;
  fs.writeFileSync(tmpEntry, originData);
  return tmpEntry;
}

function bundle(config: Config, callback: Callback) : void {
  Util.ensureFolder(config.bundleDir);

  const tmpBase = injectCodesToBase(config);
  const bundlePath = path.resolve(config.bundleDir, 'index.bundle');

  let cmd = 'react-native bundle';
  cmd += ' --entry-file ' + tmpBase;
  cmd += ' --bundle-output ' + bundlePath;
  cmd += ' --assets-dest ' + config.bundleDir;
  cmd += ' --platform ' + config.platform;

  console.log('===[Bundle] Start!===');
  console.log(cmd);
  exec(cmd, (error) => {
    if (error) {
      callback(error);
    }
    let code = fs.readFileSync(bundlePath, 'utf-8');
    if (!config.dev) {
      let globalDev = DEV_REGEX.exec(code.substring(0, 5000));
      if (globalDev) {
        console.log('Replace ' + globalDev[0] + ' with ' + DEV_FALSE);
        code = code.replace(globalDev[0], DEV_FALSE);
      }
      fs.writeFileSync(bundlePath, code, 'utf-8');
      code = UglifyJS.minify(bundlePath, {
        compress: {
          sequences: false,
          dead_code: true,
          booleans: true,
          conditionals: true,
          if_return: true
        },
        mangle: false
      }).code;
      fs.writeFileSync(bundlePath + '.min', code, 'utf-8');
    }
    callback(error, code);
    fs.unlinkSync(tmpBase);
  }).stdout.pipe(process.stdout);
}

module.exports = bundle;