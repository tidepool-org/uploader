/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 *
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

var _ = require('lodash');
var async = require('async');
var util = require('util');

var csv = require('babyparse');
var sundial = require('sundial');

var TZOUtil = require('../../TimezoneOffsetUtil');
var annotate = require('../../eventAnnotations');
var common = require('./common');
var debug = console.log //require('bows')('CareLinkDriver');
var indexDevice = require('./indexDevice');
var removeOverlaps = require('./removeOverlapping');
var getDeviceInfo = require('./getDeviceInfo');
var timeChangeProcessor = require('./timeChange')();
var LIBREVIEW_TS_FORMAT = 'DD/MM/YYYY HH:mm';

function addOutOfRangeAnnotation(recordBuilder, low, high, step, type) {
    if (low !== null && recordBuilder.value < low + step) {
      recordBuilder.with_value(low);
      annotate.annotateEvent(recordBuilder, {
        code: `${type}/out-of-range`,
        value: 'low',
        threshold: low + step,
      });
    } else if (high !== null && recordBuilder.value > high - step) {
      recordBuilder.with_value(high);
      annotate.annotateEvent(recordBuilder, {
        code: `${type}/out-of-range`,
        value: 'high',
        threshold: high - step,
      });
    }
  }

module.exports = function(simulatorMaker, api) {

    var RECORD_TYPE_HISTORIC = 0;
    var RECORD_TYPE_SCAN = 1;
    var RECORD_TYPE_STRIP = 2;
    var RECORD_TYPE_ACETONE = 3;

    const GLUCOSE_HI = 500;
    const GLUCOSE_LO = 40;

    const KETONE_HI = 8.0;
    const KETONE_LO = null; // ketone value cannot be low

    var typesToRead = {
        0: "Historic Glucose mg/dL",
        1: "Scan Glucose mg/dL",
        2: "Strip Glucose mg/dL",
        3: "Ketone mmol/L",

        4: false, // Rapid-Acting Insulin (units) OR Non-numeric Long-Acting Insulin
        5: false, // Non-numeric Food
        6: false, // ?
    }

    return function (config) {
        if (config.timezone == null) {
            throw new Error('carelinkDriver\'s config must specify a timezone');
        }

        var cfg = config, _enabled;

        return {
            enable: function() {
                _enabled = true;
            },

            disable: function() {
                _enabled = false;
            },

            // should call the callback with null, obj if the item
            // was detected, with null, null if not detected.
            // call err only if there's something unrecoverable.
            detect: function (obj, cb) {
                debug('Carelink Detect!');
                cb(null, obj);
            },

            // this function starts the chain, so it has to create but not accept
            // the result (data) object; it's then passed down the rest of the chain
            setup: function (deviceInfo, progress, cb) {
                debug('Carelink Setup!');
                progress(100);

                deviceInfo = deviceInfo || {};

                cb(null, { devices : deviceInfo });
            },

            connect: function (progress, payload, cb) {
                debug('Carelink Connect!');
                progress(100);
                cb(null, payload);
            },

            getConfigInfo: function (progress, payload, cb) {
                debug('Carelink GetConfigInfo!');
                progress(100);
                cb(null, payload);
            },

            fetchData: function (progress, payload, cb) {
                debug('Carelink FetchData!');
                debug('Carelink data', cfg.fileData.length);

                var endOfPreamble = cfg.fileData.indexOf('\n') + 1;
                // Setup the preamble to have everything up to the header line
                payload.preamble = csv.parse(cfg.fileData.substr(0, endOfPreamble), {});

                cfg.deviceInfo = getDeviceInfo(payload.preamble.data, /Pump/);
                // Store the rest of the data
                var parsed = csv.parse(cfg.fileData.substr(endOfPreamble), {
                    header: true,
                    dynamicTyping: true
                });
                payload.colLabels = parsed.meta;
                var rows = [];

                var pumpUploadId = null, pumpSeqNum = null;
                for (var i = parsed.data.length - 1; i >= 0; --i) {
                    var datum = parsed.data[i];

                    if (datum["Device"] == "") continue

                    datum.jsDate = sundial.parseFromFormat(datum['Device Timestamp'],
                                                           LIBREVIEW_TS_FORMAT);

                    datum.deviceTime = sundial.formatDeviceTime(datum.jsDate);
                    datum.csvIndex = i;

                    var record_type = datum["Record Type"];
                    if (!typesToRead[record_type]) {
                        continue
                    }
                    datum.device = datum["Device"] + " " + datum["Serial Number"]
                    datum.type = typesToRead[record_type];
                    datum.value = datum[datum.type]

                    cfg.deviceInfo.serialNumber = datum["Serial Number"];
                    cfg.deviceInfo.deviceId = datum.device;
                    cfg.builder.setDefaults({ deviceId: cfg.deviceInfo.deviceId });

                    rows.push(datum);
                }

                payload.theData = rows

                debug('Read ' + rows.length + ' entries');

                debug('Find and remove overlapping uploads from the same device model');

                debug('Separate into per-device arrays');
                for (var k = 0; k < payload.theData.length; ++k) {
                    var key = payload.theData[k].device;
                    var device = payload.devices[key];
                    if (device == null) {
                        device = {};
                        payload.devices[key] = device;

                        device.data = [];
                    }
                    device.data.push(payload.theData[k]);
                }

                delete payload.theData;

                let entry_count = 0
                Object.keys(payload.devices).forEach(function(key) {
                    var device = payload.devices[key];
                    debug("Device " + key + ": "+ device.data.length + " entries")
                    entry_count += device.data.length;
                });

                if (entry_count === 0) {
                    debug('Error reading file, no data parsed.');
                    return
                }

                cb(null, payload);
            },

            processData: function (progress, payload, cb) {
                debug('Carelink ProcessData!');
                progress(20);

                var ts = 0
                Object.keys(payload.devices).forEach(function(key) {
                    var device = payload.devices[key];
                    var mostRecentDatum = device.data[0];
                    if (mostRecentDatum.jsDate > ts) {
                        ts = mostRecentDatum.jsDate
                    }
                });

                var mostRecent = sundial.applyTimezone(ts, config.timezone).toISOString();

                let postRecords = [];
                payload.postRecords = postRecords;

                cfg.tzoUtil = new TZOUtil(config.timezone, mostRecent, postRecords);

                Object.keys(payload.devices).forEach(function(key){
                    var device = payload.devices[key];

                    var events = device.data;

                    events.filter(elem => elem["Record Type"] === RECORD_TYPE_HISTORIC)
                        .forEach((record) => {
                            const cbg = config.builder.makeCBG()
                                  .with_value(record["value"])
                                  .with_units('mg/dL')
                                  .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
                                  .set('index', record["csvIndex"]);

                            cfg.tzoUtil.fillInUTCInfo(cbg, record.jsDate);

                            addOutOfRangeAnnotation(cbg, GLUCOSE_LO, GLUCOSE_HI, 1, 'bg');
                            postRecords.push(cbg.done());
                        });
                    events.filter(elem => (elem["Record Type"] === RECORD_TYPE_STRIP || elem["Record Type"] === RECORD_TYPE_SCAN))
                        .forEach((record) => {
                            const smbg = config.builder.makeSMBG()
                                  .with_value(record["value"])
                                  .with_units('mg/dL') // values are always in 'mg/dL', independent of the unitOfMeasure setting
                                  .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
                                  .set('index', record["csvIndex"]);

                            if (record["Record Type"] === RECORD_TYPE_SCAN) {
                                smbg.with_subType('scanned');
                            }
                            addOutOfRangeAnnotation(smbg, GLUCOSE_LO, GLUCOSE_HI, 1, 'bg');
                            cfg.tzoUtil.fillInUTCInfo(smbg, record.jsDate);

                            postRecords.push(smbg.done());
                        });
                    events.filter(elem => elem["Record Type"] === RECORD_TYPE_ACETONE)
                        .forEach((record) => {
                            const ketone = config.builder.makeBloodKetone()
                                  .with_value(record["value"])
                                  .with_units('mmol/L')
                                  .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
                                  .set('index', record["csvIndex"]);

                            addOutOfRangeAnnotation(ketone, KETONE_LO, KETONE_HI, 1, 'ketone');
                            cfg.tzoUtil.fillInUTCInfo(ketone, record.jsDate);
                            postRecords.push(ketone.done());
                        });
                });
                progress(100);
                cb(null, payload);
            },

            uploadData: function (progress, payload, cb) {
                progress(0);

                const sessionInfo = {
                    deviceTags: ['bgm', 'cgm'],
                    deviceManufacturers: ['Abbott'],
                    deviceModel: 'FreeStyle Libre 2',
                    deviceSerialNumber: cfg.deviceInfo.serialNumber,
                    deviceId: cfg.deviceInfo.deviceId,
                    start: sundial.utcDateString(),
                    timeProcessing: cfg.tzoUtil.type,
                    tzName: cfg.timezone,
                    version: cfg.version,
                    blobId: payload.blobId,
                    deviceTime: cfg.deviceInfo.deviceTime,
                };

                if (cfg.deviceInfo.annotations) {
                    annotate.annotateEvent(sessionInfo, cfg.deviceInfo.annotations);
                }

                if (cfg.dev_mode) {
                    debug('<uploadData> SKIP (dev mode)');
                    return;
                }

                cfg.api.upload.toPlatform(
                    payload.postRecords, sessionInfo, progress, cfg.groupId,
                    (err, result) => {
                        progress(100);
                        if (err) {
                            return cb(err, payload);
                        }
                        payload.cleanup = true;
                        return cb(null, payload);
                    }, 'dataservices',
                );
            },

            disconnect: function (progress, payload, cb) {
                debug('Carelink Disconnect!');
                progress(100);
                cb(null, payload);
            },

            cleanup: function (progress, payload, cb) {
                debug('Carelink Cleanup!');
                progress(100);
                cb(null, payload);
            }
        };
    };
};
