/*
 Provides a set of services to build objects in a format that can
 be directly uploaded to Tidepool servers.

 Generally, call 'setDefaults' with the common fields you want to set default
 values for, then call a series of 'make' functions to build the base object,
 and then chain that to a series of 'with_' calls to set the fields. If you
 need to add a value that's not in the standard set of values for a given
 type, use the 'set' function.

 When complete, call the 'done' function, which removes the placeholders
 for optional fields and checks to make sure that required fields were
 supplied. The 'done' function returns the completed object.

 It looks like this:

 var cbg = builder.makeCBG()
 .with_value(data.glucose)
 .with_time(data.displayUtc)
 .with_deviceTime(data.displayTime)
 .set("trend", data.trendText)
 .done();

 */

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

'use strict';

var _ = require('lodash');
var util = require('util');

module.exports = function () {
  var REQUIRED = '**REQUIRED**';
  var OPTIONAL = '**OPTIONAL**';

  var deviceInfo = {
    time: REQUIRED,
    deviceTime: OPTIONAL,
    timezoneOffset: REQUIRED
  };
  function setDefaults(info) {
    deviceInfo = _.assign({}, deviceInfo, _.pick(info, 'deviceId', 'source', 'timezoneOffset'));
  }

  function _createObject() {
    return {
      // use set to specify extra values that aren't in the template for
      // the data type
      set: function set(k, v) {
        if (v == null && this[k]) {
          delete this[k];
        } else if (v != null) {
          this[k] = v;
        }
        return this;
      },

      // checks the object, removes unused optional fields,
      // and returns a copy of the object with all functions removed.
      done: function () {
        var valid = _.reduce(this, function (result, value, key) {
          if (value === REQUIRED) {
            result.push(key);
          }
          return result;
        }, []);
        if (valid.length !== 0) {
          throw new Error(util.format('Some arguments to %s(%j) were not specified!', this.type, valid.join(',')));
        }

        return _.pick(this, function (value, key) {
          return !(_.isFunction(value) || value === OPTIONAL);
        });
      },

      _bindProps: function () {
        _.forIn(this, function (value, key, obj) {
          if (!_.isFunction(value)) {
            obj['with_' + key] = obj.set.bind(obj, key);
          }
        });
      }

    };
  }

  function makeSMBG() {
    var rec = _.assign(_createObject(), deviceInfo, {
      type: 'smbg',
      value: REQUIRED,
      units: REQUIRED,
      annotation: OPTIONAL
    });
    rec._bindProps();
    return rec;
  }

  function makeCBG() {
    var rec = _.assign(_createObject(), deviceInfo, {
      type: 'cbg',
      value: REQUIRED,
      units: REQUIRED,
      annotation: OPTIONAL
    });
    rec._bindProps();
    return rec;
  }

  function makeNote() {
    var rec = _.assign(_createObject(), deviceInfo, {
      type: 'note',
      value: REQUIRED
    });
    rec._bindProps();
    return rec;
  }

  function makeBloodKetone() {
    var rec = _.assign(_createObject(), deviceInfo, {
      type: 'bloodKetone',
      units: 'mmol/L',
      value: REQUIRED,
      annotation: OPTIONAL
    });
    rec._bindProps();
    return rec;
  }

  function makeFood() {
    var rec = _.assign(_createObject(), deviceInfo, {
      type: 'food',
      carbs: REQUIRED
    });
    rec._bindProps();
    return rec;
  }

  function makeWizard() {
    var rec = _.assign(_createObject(), deviceInfo, {
      type: 'wizard',
      recommended: OPTIONAL,
      bgInput: OPTIONAL,
      carbInput: OPTIONAL,
      insulinOnBoard: OPTIONAL,
      insulinCarbRatio: OPTIONAL,
      insulinSensitivity: OPTIONAL,
      bgTarget: OPTIONAL,
      bolus: OPTIONAL,
      payload: OPTIONAL,
      units: REQUIRED
    });
    rec._bindProps();
    return rec;
  }

  function makeNormalBolus() {
    var rec = _.assign(_createObject(), deviceInfo, {
      type: 'bolus',
      subType: 'normal',
      normal: REQUIRED
    });
    rec._bindProps();
    return rec;
  }

  function makeSquareBolus() {
    var rec = _.assign(_createObject(), deviceInfo, {
      type: 'bolus',
      subType: 'square',
      extended: REQUIRED,
      duration: REQUIRED
    });
    rec._bindProps();
    return rec;
  }

  function makeDualBolus() {
    var rec = _.assign(_createObject(), deviceInfo, {
      type: 'bolus',
      subType: 'dual/square',
      normal: REQUIRED,
      extended: REQUIRED,
      duration: REQUIRED
    });
    rec._bindProps();
    return rec;
  }

  function makeDeviceMetaSuspend() {
    var rec = _.assign(_createObject(), deviceInfo, {
      type: 'deviceMeta',
      subType: 'status',
      status: 'suspended',
      reason: REQUIRED,
      previous: OPTIONAL
    });
    rec._bindProps();
    return rec;
  }

  function makeDeviceMetaResume() {
    var rec = _.assign(_createObject(), deviceInfo, {
      type: 'deviceMeta',
      subType: 'status',
      status: 'resumed',
      reason: REQUIRED,
      previous: OPTIONAL
    });
    rec._bindProps();
    return rec;
  }

  function makeDeviceMetaCalibration() {
    var rec = _.assign(_createObject(), deviceInfo, {
      type: 'deviceMeta',
      subType: 'calibration',
      value: REQUIRED,
      units: REQUIRED
    });
    rec._bindProps();
    return rec;
  }

  function makeScheduledBasal() {
    var rec = _.assign(_createObject(), deviceInfo, {
      type: 'basal',
      deliveryType: 'scheduled',
      scheduleName: REQUIRED,
      rate: REQUIRED,
      duration: REQUIRED,
      previous: OPTIONAL
    });
    rec._bindProps();
    return rec;
  }

  function makeSuspendBasal() {
    var rec = _.assign(_createObject(), deviceInfo, {
      type: 'basal',
      deliveryType: 'suspend',
      duration: OPTIONAL,
      suppressed: OPTIONAL,
      previous: OPTIONAL
    });
    rec._bindProps();
    return rec;
  }

  function makeTempBasal() {
    var rec = _.assign(_createObject(), deviceInfo, {
      type: 'basal',
      deliveryType: 'temp',
      rate: OPTIONAL,
      percent: OPTIONAL,
      duration: REQUIRED,
      previous: OPTIONAL
    });
    rec._bindProps();
    return rec;
  }

  function makeSettings() {
    var rec = _.assign(_createObject(), deviceInfo, {
      type: 'settings',
      activeSchedule: REQUIRED,
      units: REQUIRED,
      basalSchedules: {},
      carbRatio: [],
      insulinSensitivity: [],
      bgTarget: []
    });
    rec._bindProps();
    rec.add_basalScheduleItem = function (key, item) {
      if (!rec.basalSchedules[key]) {
        rec.basalSchedules[key] = [];
      }
      rec.basalSchedules[key].push(item);
    };
    rec.add_carbRatioItem = function (item) { rec.carbRatio.push(item); };
    rec.add_insulinSensitivityItem = function (item) { rec.insulinSensitivity.push(item); };
    rec.add_bgTargetItem = function (item) { rec.bgTarget.push(item); };
    return rec;
  }

  function makeUpload() {
    var rec = _.assign(_createObject(), {
      type: 'upload',
      time: REQUIRED,
      timezone: REQUIRED,
      version: REQUIRED,
      source: OPTIONAL,
      uploadId: REQUIRED,
      byUser: REQUIRED,
      deviceTags: REQUIRED,
      deviceManufacturers: OPTIONAL,
      deviceModel: OPTIONAL,
      deviceSerialNumber: OPTIONAL,
      deviceId: REQUIRED,
      payload: OPTIONAL
    });
    rec._bindProps();
    return rec;
  }

  return {
    makeBloodKetone: makeBloodKetone,
    makeCBG: makeCBG,
    makeDeviceMetaCalibration: makeDeviceMetaCalibration,
    makeDeviceMetaResume: makeDeviceMetaResume,
    makeDeviceMetaSuspend: makeDeviceMetaSuspend,
    makeDualBolus: makeDualBolus,
    makeFood: makeFood,
    makeNormalBolus: makeNormalBolus,
    makeNote: makeNote,
    makeScheduledBasal: makeScheduledBasal,
    makeSettings: makeSettings,
    makeSMBG: makeSMBG,
    makeSquareBolus: makeSquareBolus,
    makeSuspendBasal: makeSuspendBasal,
    makeTempBasal: makeTempBasal,
    makeUpload: makeUpload,
    makeWizard: makeWizard,
    setDefaults: setDefaults
  };
};