/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
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

import _ from 'lodash';
import sundial from 'sundial';

/* eslint-disable no-param-reassign, no-bitwise */

module.exports = (settings, opts) => {
  settings = settings || [];
  settings = _.sortBy(settings, (rec) => rec.systemSeconds);

  const timeChanges = []; let
    lastDisplayOffset = null;
  const allCGMSettings = []; const
    settingChanges = [];

  function convertTransmitterId(intId) {
    if (intId && intId.length === 6) {
      // it's a G5
      return intId;
    }

    const COMPONENTS = '0123456789ABCDEFGHJKLMNPQRSTUWXY'; const
      BITMASK = 0x1F;
    let strId = '';
    for (let i = 0; i < 5; ++i) {
      strId = COMPONENTS[(intId & BITMASK)] + strId;
      intId >>= 5;
    }
    return strId;
  }

  for (let i = 0; i < settings.length; ++i) {
    const rec = settings[i];
    if (rec.internalTime.slice(0, 4) !== '2009') {
      // processing for timeChanges
      if (rec.displayOffset !== lastDisplayOffset) {
        const newDate = new Date(rec.systemTimeMsec + 1000 * rec.displayOffset);
        const deviceTimeFrom = sundial.formatDeviceTime(new Date(rec.systemTimeMsec + 1000 * lastDisplayOffset));
        const change = opts.builder.makeDeviceEventTimeChange()
          .with_change({
            from: deviceTimeFrom,
            to: sundial.formatDeviceTime(newDate),
            agent: 'manual',
          })
          .with_deviceTime(deviceTimeFrom)
          .set('index', rec.systemSeconds)
          .set('jsDate', newDate)
          .with_payload({
            systemSeconds: rec.systemSeconds,
            oldDisplayOffset: lastDisplayOffset,
            newDisplayOffset: rec.displayOffset,
          });
        timeChanges.push(change);
      }
      lastDisplayOffset = rec.displayOffset;
      // processing for cgmSettings
      // magic number 5 indicates that the receiver is fully set up
      // ignores records with a transmitterId of `60000` or `400000`
      // (default, not yet set up)
      if (rec.setUpState >= 5
          && convertTransmitterId(rec.transmitterId) !== '60000'
          && rec.transmitterId !== '400000'
          && rec.transmitterId !== '888888') {
        const theseSettings = opts.builder.makeCGMSettings()
          .with_deviceTime(rec.deviceTime)
          .with_units('mg/dL')
          .with_transmitterId(convertTransmitterId(rec.transmitterId))
          .with_lowAlerts({
            enabled: rec.lowAlarmEnabled,
            level: rec.lowAlarmValue,
            snooze: rec.lowAlarmSnoozeMsec,
          })
          .with_highAlerts({
            enabled: rec.highAlarmEnabled,
            level: rec.highAlarmValue,
            snooze: rec.highAlarmSnoozeMsec,
          })
          .with_rateOfChangeAlerts({
            fallRate: {
              enabled: rec.fallRateEnabled,
              rate: -rec.fallRateValue,
            },
            riseRate: {
              enabled: rec.riseRateEnabled,
              rate: rec.riseRateValue,
            },
          })
          .with_outOfRangeAlerts({
            enabled: rec.outOfRangeEnabled,
            snooze: rec.outOfRangeSnoozeMsec,
          })
          .with_payload({
            language: rec.languageName,
            alarmProfile: rec.alarmProfileName,
            internalTime: rec.internalTime,
          })
          .set('index', rec.systemSeconds)
          .set('jsDate', rec.jsDate);

        if (rec.predictiveLowSnooze) {
          _.assign(theseSettings.payload, {
            predictiveLowSnooze: rec.predictiveLowSnooze,
            brightnessLevel: rec.brightnessLevel,
            sensorCode: rec.sensorCode,
          });
        }

        if (rec.currentGraphHeight) {
          // only available OUS at the moment
          theseSettings.payload.graphHeight = rec.currentGraphHeight;
        }

        allCGMSettings.push(theseSettings);
      }
    }
  }
  // first "change" is not a change
  timeChanges.shift();

  let lastSettings = {};
  for (let j = 0; j < allCGMSettings.length; ++j) {
    const currSettings = allCGMSettings[j];
    const fieldsForEquality = ['transmitterId', 'units', 'lowAlerts', 'highAlerts',
      'rateOfChangeAlerts', 'outOfRangeAlerts', 'predictiveAlerts', 'calibrationAlerts',
    ];
    if (!_.isEqual(_.pick(currSettings, fieldsForEquality), _.pick(lastSettings, fieldsForEquality))) {
      settingChanges.push(currSettings);
    }
    lastSettings = currSettings;
  }

  return {
    timeChanges,
    settingChanges,
  };
};
