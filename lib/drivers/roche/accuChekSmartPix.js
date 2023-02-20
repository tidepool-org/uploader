import _ from 'lodash';
import sundial from 'sundial';
import xml from 'xml2js';
import { get, set } from 'idb-keyval';

import annotate from '../../eventAnnotations';
import common from '../../commonFunctions';
import { parseDtTm } from './smartpix/accuChekSmartPixCommonXML';
import parsePumpData from './smartpix/accuChekSmartPixPumpXML';
import parseMeterData from './smartpix/accuCheckSmartPixMeterXML';

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

let smartPixHandle = null;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * List files of directory.
 *
 * @param match {string|RegExp?} Pattern to match files to return.
 * @return {[{name: string, mtime: integer, handle: object}]} List of files with modification times
 *  matching `match`.
 */
async function listDirFiles(match) {
  let matchExp = match;
  if (typeof match === 'string') {
    matchExp = new RegExp(match);
  } else if (match === undefined) {
    matchExp = null;
  }

  const dirHandle = await smartPixHandle.getDirectoryHandle('REPORT');
  const subDirHandle = await dirHandle.getDirectoryHandle('XML');

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
  let changes = [];

  const newFiles = second.filter((obj) => !first.some((o) => o.name === obj.name));
  changes = changes.concat(newFiles);

  const changedFiles = second.filter((obj2) => {
    const obj1 = first.find((o) => o.name === obj2.name);
    return obj1 && obj1.mtime !== obj2.mtime;
  });
  changes = changes.concat(changedFiles);

  return changes;
}

class AccuChekSmartPix {
  constructor(cfg) {
    log('New instance');
    this.cfg = cfg;
  }

  /**
   * @private
   * Low-level function: Start a READ operation.
   */
  static async privateLowRead() {
    await AccuChekSmartPix.privateReadTrgs('09', '00');
  }

  /**
   * Read Smart Pix v1 trigger files to trigger an action.
   *
   * @param first {string} Two-digit number of first TRG image to read.
   * @param second {string?} Optional two-digit number of second TRG image to read.
   */
  static async privateReadTrgs(first, second) {
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
  static async privateReadStatus() {
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
  static async privateWaitStatus(startVersion, expect, waitNot, progress) {
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
          const status = await AccuChekSmartPix.privateReadStatus();
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

  static async privateListReports() {
    return listDirFiles(/\.XML$/i);
  }

  /**
   * Scan and read device if one is found.
   *
   * @param progress Progress callback.
   * @returns {Promise<string>} Promise for full path of the report file.
   * @throws Error if no device could be found, no report was created,
   * multiple new reports were found, or other error.
   */
  static async read(progress) {
    let s = await AccuChekSmartPix.privateReadStatus();
    const initialReports = await AccuChekSmartPix.privateListReports();

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
        await AccuChekSmartPix.privateLowRead();
        // Wait for SCAN to activate.
        s = await AccuChekSmartPix.privateWaitStatus(s.version, 'SCAN');
      }
    }

    progress(2);
    // SCAN might include FOUND already, but if not, wait for the device to be found.
    if (privateIsNotInStatus(/FOUND\(/, s.flags)) {
      debugLog('Start data transfer');
      s = await AccuChekSmartPix.privateWaitStatus(s.version, /FOUND\(|E-.+/);
      if (privateIsInStatus(/E-.+/, s.flags)) {
        log(`Error: ${s.flags}`);
        if (_.includes(s.flags, 'SCAN')) {
          // So we have SCAN and error simultaneously. Maybe we'll find something?
          s = await AccuChekSmartPix.privateWaitStatus(s.version, /FOUND\(|NOSCAN/);
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
    s = await AccuChekSmartPix.privateWaitStatus(s.version, /IPREQUEST|IPREPORT|BGREPORT|E-.+/, undefined, () => {
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
      s = await AccuChekSmartPix.privateWaitStatus(s.version);
    }

    if (privateIsInStatus(/E-.+/, s.flags)) {
      // Conversion failed?
      log(`Reader error: ${s.flags}`);
      throw new Error('Reader error');
    }
    if (_.includes(s.flags, 'IPREPORT') || _.includes(s.flags, 'BGREPORT')) {
      progress(90);
      await delay(5000); // wait in case changes are still being written to disk
      let reports = await AccuChekSmartPix.privateListReports();
      let newReports = privateDiffReportLists(initialReports, reports);
      if (newReports.length === 0) {
        progress(95);
        log('No new reports yet, waiting a bit longer..');
        await delay(10000);
        reports = await AccuChekSmartPix.privateListReports();
        newReports = privateDiffReportLists(initialReports, reports);
      }
      progress(100);
      debugLog(`New reports: ${newReports.length}`);
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

module.exports = (config) => {
  const cfg = _.clone(config);
  cfg.deviceInfo.manufacturers = ['Roche'];
  const driver = new AccuChekSmartPix(cfg);

  return {
    /* eslint no-param-reassign:
       [ "error", { "props": true, "ignorePropertyModificationsFor": ["data", "deviceInfo"] } ] */

    detect(deviceInfo, cb) {
      cb(null, deviceInfo);
    },

    setup(deviceInfo, progress, cb) {
      progress(10);
      cb(null, { deviceInfo });
    },

    connect(deviceInfo, data, cb) {
      (async () => {
        try {
          smartPixHandle = await get('smartPix');

          if (smartPixHandle) {
            console.log(`Retrieved directory handle "${smartPixHandle.name}" from indexedDB.`);
            if ((await smartPixHandle.queryPermission()) === 'granted') {
              console.log('Permission already granted.');
              try {
                await AccuChekSmartPix.privateReadStatus();
              } catch (error) {
                console.log('Device not ready yet or not mounted.', error);
                const err = new Error(error.message);
                err.code = 'E_NOT_MOUNTED';
                return cb(err);
              }
            } else {
              console.log('Requesting permission..');
              if ((await smartPixHandle.requestPermission()) === 'granted') {
                try {
                  await AccuChekSmartPix.privateReadStatus();
                } catch (err) {
                  // device mounted on a different drive number/letter, so we'll have to
                  // show directory picker again
                  console.log(err.name, err.message);
                  try {
                    smartPixHandle = await window.showDirectoryPicker();
                    await set('smartPix', smartPixHandle);
                    await AccuChekSmartPix.privateReadStatus();
                  } catch (error) {
                    return cb(error);
                  }
                }
              }
            }
          } else {
            try {
              smartPixHandle = await window.showDirectoryPicker();
              set('smartPix', smartPixHandle);
            } catch (error) {
              return cb(error);
            }
          }
        } catch (e) {
          log(e);
          return cb(e);
        }

        return cb(null, data);
      })();
    },

    getConfigInfo(progress, data, cb) {
      data.stage = 'config';
      cb(null, data);
    },

    fetchData(progress, data, cb) {
      data.stage = 'fetch';
      (async () => {
        try {
          if (QUICK_SINGLE_REPORT === true) {
            // This path will short-circuit a single report to the result
            // to avoid waiting for a long re-read to complete.
            const files = await AccuChekSmartPix.privateListReports();
            if (files.length === 1) {
              data.dataFile = [files];
              return cb(null, data);
            }
          } else if (QUICK_SINGLE_REPORT) {
            data.dataFile = QUICK_SINGLE_REPORT;
            return cb(null, data);
          }

          data.dataFile = await AccuChekSmartPix.read(progress);
          return cb(null, data);
        } catch (e) {
          log(e);
          return cb(e);
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
