import fsCore from 'fs';
import path from 'path';

import _ from 'lodash';
import sundial from 'sundial';
import xml from 'xml2js';

import annotate from '../../eventAnnotations';
import common from '../../commonFunctions';
import { parseDtTm } from './smartpix/accuChekSmartPixCommonXML';
import parsePumpData from './smartpix/accuChekSmartPixPumpXML';
import parseMeterData from './smartpix/accuCheckSmartPixMeterXML';

const fs = fsCore.promises; // Current version doesn't have this public yet.
const isBrowser = typeof window !== 'undefined';

// eslint-disable-next-line no-console
const log = isBrowser ? require('bows')('AccuChekSmartPixDriver') : console.log;

/** Enable debug logging? */
const AC_DEBUG = true;

/**
 * If true, some log will be printed, and an already read single report in the reader
 * will not be re-read. If no reports are found, new read is started.
 * If a string, it is expected to be full path to report that should be processed.
 *
 * NOTE: The sending will fail due a time check, see {@link privateCheckTime}.
 */
const QUICK_SINGLE_REPORT = false;

// eslint-disable-next-line no-console
const debugLog = AC_DEBUG ? console.log : () => {};

let smartPixHandle;

/**
 * List files of directory.
 *
 * @param dirPath {string} Path to directory.
 * @param match {string|RegExp?} Pattern to match files to return.
 * @return {[{name: string, mtime: integer, handle: object}]} List of files with modification times
 *  in `dirPath` matching `match`.
 */
async function listDirFiles(dirPath, match) {
  let matchExp = match;
  if (typeof match === 'string') {
    matchExp = new RegExp(match);
  } else if (match === undefined) {
    matchExp = null;
  }

  const dirHandle = await smartPixHandle.getDirectoryHandle('REPORT');
  const subDirHandle = await dirHandle.getDirectoryHandle('XML');
  // TODO: save directory handle to db; make dirPath generic

  const foundFiles = [];
  // eslint-disable-next-line no-restricted-syntax
  for await (const entry of subDirHandle.values()) {
    console.log(entry);

    if (matchExp.test(entry.name)) {
      const handle = await entry.getFile();
      const file = {
        handle,
        name: entry.name,
        mtime: handle.lastModified,
      };
      foundFiles.push(file);
    }
  }

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

/** Read a file */
async function privateGetFile(directory, filename) {
  const dirHandle = await smartPixHandle.getDirectoryHandle(directory);
  // eslint-disable-next-line no-restricted-syntax
  for await (const entry of dirHandle.values()) {
    if (entry.name === filename) {
      return entry.getFile();
    }
  }
  return null;
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
  const firstLookup = new Map();
  const secondLookup = new Map();
  _.forEach(first, (e) => firstLookup.set(e.name, e.mtime));
  _.forEach(second, (e) => secondLookup.set(e.name, e.mtime));

  let changes = [];

  const newFiles = _.differenceBy(first, second, 'name');
  changes = changes.concat(newFiles);

  const existingFiles = _.intersectionBy(second, first, 'name');
  _.forEach(existingFiles, (existingFile) => {
    const time1 = firstLookup.get(existingFile.name);
    const time2 = secondLookup.get(existingFile.name);
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
    this.reportPath = ['REPORT', 'XML'];
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
    const dir = 'TRG';
    const f1 = `TRG${first}.PNG`;
    const file1 = await privateGetFile(dir, f1);
    await file1.arrayBuffer(); // read to trigger

    if (second !== undefined) {
      const f2 = `TRG${second}.PNG`;
      const file2 = await privateGetFile(dir, f2);
      await file2.arrayBuffer(); // read to trigger
    }
  }

  /**
   * @private
   * Read current status values from the device.
   *
   * @return {Promise<Object>} Object containing status `.version` number and `.flags` as a list.
   */
  async privateReadStatus() {
    const file = await privateGetFile('MISC', 'STATUS.TXT');
    const text = _.trim(await file.text());
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

  /**
   * Scan and read device if one is found.
   *
   * @param progress Progress callback.
   * @returns {Promise<string>} Promise for full path of the report file.
   * @throws Error if no device could be found, no report was created,
   * multiple new reports were found, or other error.
   */
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
    s = await this.privateWaitStatus(s.version, /IPREQUEST|IPREPORT|BGREPORT|E-.+/, undefined, () => {
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
    if (!_.includes(s.flags, 'IPREPORT') && !_.includes(s.flags, 'BGREPORT') && _.includes(s.flags, 'IPREQUEST')) {
      // Read completed, reader converts the data.
      progress(progressVal + 1);
      s = await this.privateWaitStatus(s.version);
    }

    if (privateIsInStatus(/E-.+/, s.flags)) {
      // Conversion failed?
      log(`Reader error: ${s.flags}`);
      throw new Error('Reader error');
    }
    if (_.includes(s.flags, 'IPREPORT') || _.includes(s.flags, 'BGREPORT')) {
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
   * @param fullPath {string} Full name of the report XML file.
   * @param progress {Function} Progress callback.
   * @returns {Promise<Object>} The report data from parser: `.metadata` and `.records[]`.
   */
  async process(fullPath, progress) {
    progress(0);
    const parser = xml.Parser({
      explicitChildren: true,
      preserveChildrenOrder: true,
    });
    const buffer = await fullPath.handle.text();
    progress(25);
    const document = await new Promise((resolve, reject) => {
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

    let data = null;
    if (document.IMPORT.IP) {
      await this.privateCheckTime(document.IMPORT.IP[0].$);
      data = parsePumpData(document, this.cfg);
    } else if (document.IMPORT.DEVICE) {
      await this.privateCheckTime(document.IMPORT.DEVICE[0].$);
      data = parseMeterData(document, this.cfg);
    } else {
      throw new Error('Unknown type of data file');
    }
    progress(100);
    return data;
  }

  /** Check that date of the export is close enough to current time. */
  async privateCheckTime(entry) {
    // XXX: This private field is accessed in checkDeviceTime.
    this.cfg.deviceInfo.deviceTime = sundial.formatDeviceTime(parseDtTm(entry));
    await new Promise((resolve, reject) => {
      common.checkDeviceTime(this.cfg, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

function grepDeviceFromDrives(cb) {
  /* eslint-disable-next-line import/no-extraneous-dependencies, global-require */
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
  cfg.deviceInfo.manufacturers = ['Roche'];
  const driver = new AccuChekSmartPix(cfg);

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
          smartPixHandle = await window.showDirectoryPicker(); // TODO: check if we already have permission

          if (QUICK_SINGLE_REPORT === true) {
            // This path will short-circuit a single report to the result
            // to avoid waiting for a long re-read to complete.
            const files = await driver.privateListReports();
            if (files.length === 1) {
              data.dataFile = [files];
              cb(null, data);
              return;
            }
          } else if (QUICK_SINGLE_REPORT) {
            data.dataFile = QUICK_SINGLE_REPORT;
            cb(null, data);
            return;
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
          data.post_records = result.records;

          if (data.post_records.length === 0) {
            cb(new Error('Device has no records to upload'));
          } else {
            cfg.deviceInfo.serialNumber = result.metadata.serialNumber;
            cfg.deviceInfo.model = result.metadata.model;
            cfg.deviceInfo.tags = result.metadata.tags;
            cfg.deviceInfo.deviceId = result.metadata.deviceId;
            data.deviceModel = cfg.deviceInfo.model; // for metrics
            debugLog(data);
            cb(null, data);
          }
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
        data.post_records, sessionInfo, progress, cfg.groupId,
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
