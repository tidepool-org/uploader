import fsCore from 'fs';
import path from 'path';

import _ from 'lodash';
import sundial from 'sundial';
import xml from 'xml2js';

import annotate from '../../eventAnnotations';
import TZOUtil from '../../TimezoneOffsetUtil';
import { parsePumpData } from './smartpix/accuChekSmartPixPumpXML';

const fs = fsCore.promises; // Current version doesn't have this public yet.
const isBrowser = typeof window !== 'undefined';

// eslint-disable-next-line no-console
const log = isBrowser ? require('bows')('AccuChekSmartPixDriver') : console.log;

/** Enable debug logging? */
const AC_DEBUG = false;

/**
 * If true, some log will be printed, and an already read single report in the reader
 * will not be re-read.
 */
const QUICK_SINGLE_REPORT = false;

// eslint-disable-next-line no-console
const debugLog = AC_DEBUG ? console.log : () => {};

/**
 * List files of directory.
 *
 * @param dirPath {string} Path to directory.
 * @param match {string|RegExp?} Pattern to match files to return.
 * @return {[{name: string, mtime: integer}]} List of files with modification times
 *  in `dirPath` matching `match`.
 */
async function listDirFiles(dirPath, match) {
  let matchExp = match;
  if (typeof match === 'string') {
    matchExp = new RegExp(match);
  } else if (match === undefined) {
    matchExp = null;
  }

  const dir = await fs.opendir(dirPath);

  let aDir = await dir.read();
  const foundFiles = [];
  while (aDir != null) {
    if (aDir.isFile() && (matchExp === null || matchExp.test(aDir.name))) {
      // `for await` is not available and other choices need result from previous iteration.
      // eslint-disable-next-line no-await-in-loop
      const stat = await fs.stat(aDir.name);

      foundFiles.push({
        name: aDir.name,
        mtime: stat.mtime,
      });
    }
    // eslint-disable-next-line no-await-in-loop
    aDir = await dir.read();
  }

  await dir.close();
  return foundFiles;
}

/**
 * @private
 * Parse STATUS.TXT status line.
 *
 * @param line {string} The status line read from the file.
 * @return {Object} Object containing status `.version` number and `.flags` as a list.
 */
function privateParseStatus(line) {
  if (line === '') {
    return {
      version: 0,
      flags: ['INTERNAL_ERROR'],
    };
  }
  const pat = /(\d+|[\w,-]+(\([\w, -]+\))?)(?: |$)/g;
  const parts = Array.from(line.matchAll(pat), (m) => m[1]);
  return {
    version: Number.parseInt(parts[0], 10),
    flags: parts.slice(1),
  };
}

/**
 * @private
 * Check if given pattern exists in status set.
 *
 * @param pattern {string|RegExp} Pattern to test.
 *  Note, that if a string, it is compiled to RegExp.
 * @param status {[string]} List of status flags.
 * @returns {boolean} True if given pattern exists in status set. False if not.
 */
function privateIsInStatus(pattern, status) {
  let exp = pattern;
  if (typeof pattern === 'string') {
    exp = new RegExp(pattern);
  }
  return _.find(status, (value) => exp.test(value)) !== undefined;
}

/**
 * @private
 * Check if given pattern is absent in status set.
 *
 * @param pattern {string|RegExp} Pattern to test. Note, that if a string, it is compiled to RegExp.
 * @param status {[string]} List of status flags.
 * @returns {boolean} True if given pattern does not exists in status set. False if it exists.
 */
function privateIsNotInStatus(pattern, status) {
  let exp = pattern;
  if (typeof pattern === 'string') {
    exp = new RegExp(pattern);
  }
  return _.every(status, (value) => !exp.test(value));
}

/** Read a file, just ignoring the content. */
async function privateReadFileIgnoreContent(filename) {
  await fs.readFile(filename);
}

/**
 * @private
 * Resolve difference from two sets of file lists.
 *
 * @param first {[{name: string, mtime: integer}]} List of file-infos having `.name` and `.mtime`,
 *  from {@link listDirFiles}.
 * @param second {[{name: string, mtime: integer}]} List of file-infos having `.name` and `.mtime`,
 *  from {@link listDirFiles}.
 * @returns {[string]} List of new or changed files.
 */
function privateDiffReportLists(first, second) {
  const firstFiles = _.map(first, (e) => e.name);
  const secondFiles = _.map(second, (e) => e.name);
  const firstLookup = new Map();
  const secondLookup = new Map();
  _.forEach(first, (e) => firstLookup.set(e.name, e.mtime));
  _.forEach(second, (e) => secondLookup.set(e.name, e.mtime));

  let changes = [];

  const newFiles = _.difference(secondFiles, firstFiles);
  changes = changes.concat(newFiles);

  const existingFiles = _.intersection(secondFiles, firstFiles);
  _.forEach(existingFiles, (existingFile) => {
    const time1 = firstLookup.get(existingFile);
    const time2 = secondLookup.get(existingFile);
    if (time1 !== time2) {
      changes.push(existingFile);
    }
  });

  return changes;
}

class AccuChekSmartPix {
  constructor(cfg) {
    log('New instance');
    this.cfg = cfg;
    this.path = null;
  }

  setup(di) {
    this.path = di.path;
    this.reportPath = path.join(this.path, 'REPORT', 'XML');
  }

  /**
   * @private
   * Low-level function: Start a READ operation.
   */
  async privateLowRead() {
    await this.privateReadTrgs('09', '00');
  }

  /**
   * Read Smart Pix v1 trigger files to trigger an action.
   *
   * @param first {string} Two-digit number of first TRG image to read.
   * @param second {string?} Optional two-digit number of second TRG image to read.
   */
  async privateReadTrgs(first, second) {
    debugLog(`Read TRGs ${first}, ${second}`);
    const base = path.join(this.path, 'TRG');
    const f1 = path.join(base, `TRG${first}.PNG`);
    await privateReadFileIgnoreContent(f1);

    if (second !== undefined) {
      const f2 = path.join(base, `TRG${second}.PNG`);
      await privateReadFileIgnoreContent(f2);
    }
  }

  /**
   * @private
   * Read current status values from the device.
   *
   * @return {Promise<Object>} Object containing status `.version` number and `.flags` as a list.
   */
  async privateReadStatus() {
    const statusFileName = path.join(this.path, 'MISC', 'STATUS.TXT');
    const content = await fs.readFile(statusFileName);
    const text = _.trim(content.toString('utf-8'));
    return privateParseStatus(text);
  }

  /**
   * @private
   * Wait for status to change.
   *
   * @param startVersion {integer} Current status version number to ignore.
   * @param expect {string|RegExp?} Pattern to expect to appear or disappear from status flags.
   * @param waitNot {boolean?} If falsy, pattern is expected to appear.
   *  If truthy, pattern is expected to disappear.
   * @param progress {Function?} Optional progress callback, called every 2s.
   * @return {Promise<Object>} New status values (`.version`, `.flags`).
   */
  async privateWaitStatus(startVersion, expect, waitNot, progress) {
    let pattern;
    if (typeof expect === 'string') {
      pattern = new RegExp(expect);
    } else {
      pattern = expect;
    }
    const waitFn = waitNot ? privateIsNotInStatus : privateIsInStatus;

    log(`Waiting at ${startVersion} ${waitNot ? 'while exists' : 'until'} ${expect}`);

    return new Promise((resolve, reject) => {
      let prevVersion = startVersion;
      let progressDivider = 0;
      const loop = async () => {
        try {
          const status = await this.privateReadStatus();
          if (prevVersion !== status.version) {
            debugLog(`Wait version: ${status.version}: ${status.flags}`);
            prevVersion = status.version;
          }
          if (progress) {
            progressDivider += 1;
            if (progressDivider >= 2) {
              progressDivider = 0;
              progress();
            }
          }
          // If version hasn't increased,
          // or if flags should be checked and the check fails,
          // wait more.
          if (status.version <= startVersion || (pattern && !waitFn(pattern, status.flags))) {
            setTimeout(loop, 500);
          } else {
            resolve(status);
          }
        } catch (e) {
          debugLog(`Wait error: ${e}`);
          reject(e);
        }
      };
      setTimeout(loop, 500);
    });
  }

  async privateListReports() {
    return listDirFiles(this.reportPath, /\.XML$/i);
  }

  async read(progress) {
    let s = await this.privateReadStatus();
    const initialReports = await this.privateListReports();

    debugLog(`Start state: ${s.flags}`);
    if (!_.isEqual(s.flags, ['AUTOSCAN'])) {
      if (_.includes(s.flags, 'SCAN')) {
        // Fall through, it's okay if scan was already started
        // unless we are already in conversion phase.
        debugLog('Already scanning...');
      }
      if (_.includes(s.flags, 'IPREQUEST') || privateIsInStatus(/FOUND\(/, s.flags)) {
        // FOUND could perhaps fall through, but not sure what the device is doing already.
        // IPREQUEST might be present if previous read was interrupted. To resolve,
        // device needs to be reset. (Report erase would also resolve this...)
        throw new Error('Device busy');
      }
      if (_.includes(s.flags, 'NOSCAN')) {
        progress(1);
        // Start read.
        await this.privateLowRead();
        // Wait for SCAN to activate.
        s = await this.privateWaitStatus(s.version, 'SCAN');
      }
    }

    progress(2);
    // SCAN might include FOUND already, but if not, wait for the device to be found.
    if (privateIsNotInStatus(/FOUND\(/, s.flags)) {
      debugLog('Start data transfer');
      s = await this.privateWaitStatus(s.version, /FOUND\(|E-.+/);
      if (privateIsInStatus(/E-.+/, s.flags)) {
        log(`Error: ${s.flags}`);
        if (_.includes(s.flags, 'SCAN')) {
          // So we have SCAN and error simultaneously. Maybe we'll find something?
          s = await this.privateWaitStatus(s.version, /FOUND\(|NOSCAN/);
          if (_.includes(s.flags, 'NOSCAN')) {
            // Scan stopped. Gave up.
            throw new Error('No device found.');
          }
        } else {
          // Error and no indication of other work.
          throw new Error('No device found?');
        }
      }
    } else {
      debugLog('Already transferring');
    }

    progress(3);
    let progressVal = 5;
    // Reading the device into reader.
    // This wait takes a while.
    s = await this.privateWaitStatus(s.version, /IPREQUEST|IPREPORT|E-.+/, undefined, () => {
      if (progressVal < 100) {
        progress(progressVal);
        progressVal += 1;
      }
    });
    if (privateIsInStatus(/E-.+/, s.flags)) {
      // Read was probably interrupted.
      log(`Read error: ${s.flags}`);
      throw new Error('Read error');
    }
    if (!_.includes(s.flags, 'IPREPORT') && _.includes(s.flags, 'IPREQUEST')) {
      // Read completed, reader converts the data.
      progress(progressVal + 1);
      s = await this.privateWaitStatus(s.version);
    }

    if (privateIsInStatus(/E-.+/, s.flags)) {
      // Conversion failed?
      log(`Reader error: ${s.flags}`);
      throw new Error('Reader error');
    }
    if (_.includes(s.flags, 'IPREPORT')) {
      progress(99);
      const reports = await this.privateListReports();
      const newReports = privateDiffReportLists(initialReports, reports);
      progress(100);
      debugLog(`New reports: ${newReports}`);
      if (newReports.length !== 1) {
        throw new Error(`Unexpected amount of reports: ${newReports.length}`);
      } else {
        return newReports[0];
      }
    } else {
      log(`Unknown status: ${s.flags}`);
      throw new Error('Unknown status');
    }
  }

  /**
   * Process report data file.
   *
   * @param dataFile {string} Base name of the report XML file.
   * @param progress {Function} Progress callback.
   * @returns {Promise<Object>} The report data from parser: `.metadata` and `.records[]`.
   */
  async process(dataFile, progress) {
    progress(0);
    const parser = xml.Parser({
      explicitChildren: true,
      preserveChildrenOrder: true,
    });
    const fullPath = path.join(this.reportPath, dataFile);
    const buffer = await fs.readFile(fullPath, { encoding: 'utf-8' });
    progress(25);
    const result = await new Promise((resolve, reject) => {
      try {
        parser.parseString(buffer, (error, doc) => {
          if (error) {
            reject(error);
          } else {
            resolve(doc);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
    progress(50);
    const data = parsePumpData(result);
    progress(100);
    return data;
  }
}

function grepDeviceFromDrives(cb) {
  const drivelist = require('drivelist');
  drivelist.list().then((drives) => {
    const smartPixes = _.filter(drives, (d) => d.busType === 'USB' && d.description.indexOf('SMART_PIX') >= 0);
    const mountedSmartPixes = _.filter(smartPixes, (d) => d.mountpoints.length === 1);

    if (smartPixes.length === 0) {
      cb(new Error('No SmartPix device found.'));
    } else if (mountedSmartPixes.length === 0) {
      cb(new Error('SmartPix device must be mounted first.'));
    } else if (mountedSmartPixes.length > 1) {
      cb(new Error('Multiple SmartPix devices found.'));
    } else {
      cb(null, smartPixes[0]);
    }
  }, (err) => {
    cb(err);
  });
}

async function testPathIsDir(pathName) {
  const stat = await fs.stat(pathName);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${pathName}`);
  }
}

module.exports = (config) => {
  const cfg = _.clone(config);
  const driver = new AccuChekSmartPix(cfg);

  cfg.deviceInfo.manufacturers = ['Roche'];
  cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []); // FIXME
  return {
    /* eslint no-param-reassign:
       [ "error", { "props": true, "ignorePropertyModificationsFor": ["data", "deviceInfo"] } ] */

    detect(deviceInfo, cb) {
      grepDeviceFromDrives((grepErr, driveInfo) => {
        if (grepErr) {
          log(grepErr);
          cb(grepErr);
        } else {
          const mpPath = driveInfo.mountpoints[0].path;
          (async () => {
            try {
              await testPathIsDir(path.join(mpPath, 'MISC'));
              log(`Found SmartPix in ${mpPath}`);
              deviceInfo.path = mpPath;
              cb(null, deviceInfo);
            } catch (dirErr) {
              log(dirErr);
              cb(dirErr);
            }
          })();
        }
      });
    },

    setup(deviceInfo, progress, cb) {
      progress(10);

      driver.setup(deviceInfo);
      cb(null, { deviceInfo });
    },

    connect(deviceInfo, data, cb) {
      cb(null, data);
    },

    getConfigInfo(progress, data, cb) {
      data.stage = 'config';
      cb(null, data);
    },

    fetchData(progress, data, cb) {
      data.stage = 'fetch';
      (async () => {
        try {
          if (QUICK_SINGLE_REPORT) {
            // This path will short-circuit a single report to the result
            // to avoid waiting for a long re-read to complete.
            const files = await driver.privateListReports();
            if (files.length === 1) {
              data.dataFile = files[0].name;
              cb(null, data);
              return;
            }
          }

          data.dataFile = await driver.read(progress);
          cb(null, data);
        } catch (e) {
          log(e);
          cb(e);
        }
      })();
    },

    processData(progress, data, cb) {
      data.stage = 'process';
      (async () => {
        try {
          const result = await driver.process(data.dataFile, progress);
          data.records = result.records;
          data.deviceInfo.serialNumber = result.metadata.serialNumber;
          data.deviceInfo.model = result.metadata.model;
          data.deviceInfo.tags = result.metadata.tags;
          data.deviceInfo.deviceId = result.metadata.deviceId;
          debugLog(data);
          cb(null, data);
        } catch (e) {
          log(e);
          cb(e);
        }
      })();
    },

    uploadData(progress, data, cb) {
      data.stage = 'upload';

      const sessionInfo = {
        deviceTags: cfg.deviceInfo.tags,
        deviceManufacturers: cfg.deviceInfo.manufacturers,
        deviceModel: cfg.deviceInfo.model,
        deviceSerialNumber: cfg.deviceInfo.serialNumber,
        deviceTime: cfg.deviceInfo.deviceTime, // FIXME
        deviceId: cfg.deviceInfo.deviceId,
        start: sundial.utcDateString(),
        timeProcessing: cfg.tzoUtil.type,
        tzName: cfg.timezone,
        version: cfg.version,
      };

      if (cfg.deviceInfo.annotations) {
        annotate.annotateEvent(sessionInfo, cfg.deviceInfo.annotations);
      }
      log('To platform');
      cfg.api.upload.toPlatform(
        data.records, sessionInfo, progress, cfg.groupId,
        (err, result) => {
          progress(100);

          if (err) {
            log(err);
            log(result);
            return cb(err, data);
          }
          return cb(null, data);
        },
        'dataservices',
      );
    },

    disconnect(progress, data, cb) {
      data.stage = 'disconnect';
      cb(null, data);
    },

    cleanup(progress, data, cb) {
      data.stage = 'cleanup';
      cb(null, data);
    },
  };
};

module.exports.Driver = AccuChekSmartPix;
