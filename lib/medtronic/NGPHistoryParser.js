/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2017, Tidepool Project
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

/* globals chrome, __DEBUG__  */

// I *like* for..in
/* eslint no-restricted-syntax: [0, "ForInStatement"] */

// const _ = require('lodash');
// const struct = require('../struct.js')();
// const common = require('../commonFunctions');
// const annotate = require('../eventAnnotations');
// const TZOUtil = require('../TimezoneOffsetUtil');
const sundial = require('sundial');
const NGPUtil = require('./NGPUtil');

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('../bows')('Medtronic600Driver') : console.log;

class NGPHistoryEvent {
  static get EVENT_TYPE() {
    return {
      TIME_RESET: 0x02,
      USER_TIME_DATE_CHANGE: 0x03,
      SOURCE_ID_CONFIGURATION: 0x04,
      NETWORK_DEVICE_CONNECTION: 0x05,
      AIRPLANE_MODE: 0x06,
      START_OF_DAY_MARKER: 0x07,
      END_OF_DAY_MARKER: 0x08,
      PLGM_CONTROLLER_STATE: 0x0B,
      NORMAL_BOLUS_PROGRAMMED: 0x15,
      SQUARE_BOLUS_PROGRAMMED: 0x16,
      DUAL_BOLUS_PROGRAMMED: 0x17,
      CANNULA_FILL_DELIVERED: 0x1A,
      TEMP_BASAL_PROGRAMMED: 0x1B,
      BASAL_PATTERN_SELECTED: 0x1C,
      BASAL_SEGMENT_START: 0x1D,
      INSULIN_DELIVERY_STOPPED: 0x1E,
      INSULIN_DELIVERY_RESTARTED: 0x1F,
      SELF_TEST_REQUESTED: 0x20,
      SELF_TEST_RESULTS: 0x21,
      TEMP_BASAL_COMPLETE: 0x22,
      BOLUS_SUSPENDED: 0x24,
      SUSPENDED_BOLUS_RESUMED: 0x25,
      SUSPENDED_BOLUS_CANCELED: 0x26,
      BOLUS_CANCELED: 0x27,
      ALARM_NOTIFICATION: 0x28,
      ALARM_CLEARED: 0x2A,
      LOW_RESERVOIR: 0x2B,
      BATTERY_INSERTED: 0x2C,
      FOOD_MARKER: 0x2E,
      EXERCISE_MARKER: 0x2F,
      INJECTION_MARKER: 0x30,
      OTHER_MARKER: 0x31,
      BG_READING: 0x32,
      CODE_UPDATE: 0x33,
      MISSED_MEAL_BOLUS_REMINDER_EXPIRED: 0x34,
      REWIND: 0x36,
      BATTERY_REMOVED: 0x37,
      CALIBRATION_COMPLETE: 0x38,
      ACTIVE_INSULIN_CLEARED: 0x39,
      DAILY_TOTALS: 0x3C,
      BOLUS_WIZARD_ESTIMATE: 0x3D,
      USER_SETTINGS_SAVE: 0x50,
      USER_SETTINGS_RESETTO_DEFAULTSS: 0x51,
      OLD_BASAL_PATTERN: 0x52,
      NEW_BASAL_PATTERN: 0x53,
      OLD_PRESET_TEMP_BASAL: 0x54,
      NEW_PRESET_TEMP_BASAL: 0x55,
      OLD_PRESET_BOLUS: 0x56,
      NEW_PRESET_BOLUS: 0x57,
      MAX_BASAL_RATE_CHANGE: 0x58,
      MAX_BOLUS_CHANGE: 0x59,
      PERSONAL_REMINDER_CHANGE: 0x5A,
      MISSED_MEAL_BOLUS_REMINDER_CHANGE: 0x5B,
      BOLUS_INCREMENT_CHANGE: 0x5C,
      BOLUS_WIZARD_SETTINGS_CHANGE: 0x5D,
      OLD_BOLUS_WIZARD_INSULIN_SENSITIVITY: 0x5E,
      NEW_BOLUS_WIZARD_INSULIN_SENSITIVITY: 0x5F,
      OLD_BOLUS_WIZARD_INSULIN_TO_CARB_RATIOS: 0x60,
      NEW_BOLUS_WIZARD_INSULIN_TO_CARB_RATIOS: 0x61,
      OLD_BOLUS_WIZARD_BG_TARGETS: 0x62,
      NEW_BOLUS_WIZARD_BG_TARGETS: 0x63,
      DUAL_BOLUS_OPTION_CHANGE: 0x64,
      SQUARE_BOLUS_OPTION_CHANGE: 0x65,
      EASY_BOLUS_OPTION_CHANGE: 0x66,
      BG_REMINDER_OPTION_CHANGE: 0x68,
      BG_REMINDER_TIME: 0x69,
      AUDIO_VIBRATE_MODE_CHANGE: 0x6A,
      TIME_FORMAT_CHANGE: 0x6B,
      LOW_RESERVOIR_WARNING_CHANGE: 0x6C,
      LANGUAGE_CHANGE: 0x6D,
      STARTUP_WIZARD_START_END: 0x6E,
      REMOTE_BOLUS_OPTION_CHANGE: 0x6F,
      AUTO_SUSPEND_CHANGE: 0x72,
      BOLUS_DELIVERY_RATE_CHANGE: 0x73,
      DISPLAY_OPTION_CHANGE: 0x77,
      SET_CHANGE_REMINDER_CHANGE: 0x78,
      BLOCK_MODE_CHANGE: 0x79,
      BOLUS_WIZARD_SETTINGS_SUMMARY: 0x7B,
      SENSOR_SETTINGS_CHANGE: 0xC8,
      OLD_SENSOR_WARNING_LEVELS: 0xC9,
      NEW_SENSOR_WARNING_LEVELS: 0xCA,
      GENERAL_SENSOR_SETTINGS_CHANGE: 0xCB,
      SENSOR_GLUCOSE_READINGS: 0xCC,
      SENSOR_GLUCOSE_GAP: 0xCD,
      GLUCOSE_SENSOR_CHANGE: 0xCE,
      SENSOR_CALIBRATION_REJECTED: 0xCF,
      SENSOR_ALERT_SILENCE_STARTED: 0xD0,
      SENSOR_ALERT_SILENCE_ENDED: 0xD1,
      OLD_LOW_SENSOR_WARNING_LEVELS: 0xD2,
      NEW_LOW_SENSOR_WARNING_LEVELS: 0xD3,
      OLD_HIGH_SENSOR_WARNING_LEVELS: 0xD4,
      NEW_HIGH_SENSOR_WARNING_LEVELS: 0xD5,
      SENSOR_GLUCOSE_READINGS_EXTENDED: 0xD6,
      NORMAL_BOLUS_DELIVERED: 0xDC,
      SQUARE_BOLUS_DELIVERED: 0xDD,
      DUAL_BOLUS_PART_DELIVERED: 0xDE,
    };
  }

  constructor(eventData) {
    this.eventData = eventData;
  }

  get source() {
    // No idea what "source" means.
    return this.eventData[0x01];
  }

  get size() {
    return this.eventData[0x02];
  }

  get eventType() {
    return this.eventData[0];
  }

  eventInstance() {
    /* eslint-disable no-use-before-define */
    switch (this.eventType) {
      case NGPHistoryEvent.EVENT_TYPE.SENSOR_GLUCOSE_READINGS_EXTENDED:
        return new SensorGlucoseReadingsEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.BG_READING:
        return new BloodGlucoseReadingEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.BASAL_SEGMENT_START:
        return new BasalSegmentStartEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.TEMP_BASAL_COMPLETE:
        return new TempBasalCompleteEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.REWIND:
        return new RewindEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.CANNULA_FILL_DELIVERED:
        return new CannulaFillDeliveredEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.NORMAL_BOLUS_DELIVERED:
        return new NormalBolusDeliveredEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.SQUARE_BOLUS_DELIVERED:
        return new SquareBolusDeliveredEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.DUAL_BOLUS_PART_DELIVERED:
        return new DualBolusPartDeliveredEvent(this.eventData);
      default:
        // debug('Unknown Instance type:', this.eventType);
        // Return a default NGPHistoryEvent
        return this;
    }
    /* eslint-enable no-use-before-define */
  }

  get timestamp() {
    return NGPUtil.NGPTimestamp.fromBuffer(this.eventData.slice(0x03, 0x0B));
  }

  get dynamicActionRequestor() {
    return this.eventData[0x01];
  }
}

class SensorGlucoseReadingsEvent extends NGPHistoryEvent {
  get minutesBetweenReadings() {
    return this.eventData[0x0B];
  }

  get numberOfReadings() {
    return this.eventData[0x0C];
  }

  get predictedSg() {
    return this.eventData.readUInt16BE(0x0D);
  }

  // TODO - should move this to a Util class
  static make32BitIntFromNBitSignedInt(signedValue, nBits) {
    /* eslint-disable no-bitwise */
    const sign = ((0xFFFFFFFF << nBits) & 0xFFFFFFFF) * ((signedValue >> nBits - 1) & 1);
    return (sign | signedValue) & 0xFFFFFFFF;
    /* eslint-enable no-bitwise */
  }

  * readings() {
    /* eslint-disable no-bitwise */
    let pos = 15;
    for (let i = 0; i < this.numberOfReadings; i++) {
      const timestamp = new Date(this.timestamp.toDate().getTime() -
        (i * this.minutesBetweenReadings * sundial.MIN_TO_MSEC));
      const sg = ((this.eventData[pos] & 3) << 8) | this.eventData[pos + 1];
      const vctr = SensorGlucoseReadingsEvent.make32BitIntFromNBitSignedInt(
        (((this.eventData[pos] >> 2) & 3) << 8) | this.eventData[pos + 4], 10) / 100.0;
      const isig = this.eventData.readInt16BE(pos + 2) / 100.0;
      const rateOfChange = this.eventData.readInt16BE(pos + 5) / 100.0;
      const readingStatus = this.eventData[pos + 8];
      const sensorStatus = this.eventData[pos + 7];

      const backfilledData = (readingStatus & 1) === 1;
      const settingsChanged = (readingStatus & 2) === 1;
      const noisyData = sensorStatus === 1;
      const discardData = sensorStatus === 2;
      const sensorError = sensorStatus === 3;
      // TODO - handle all the error states where sg >= 769 (see ParseCGM.js)

      pos += 9;

      yield {
        timestamp,
        sg,
        predictedSg: this.predictedSg,
        isig,
        vctr,
        rateOfChange,
        backfilledData,
        settingsChanged,
        noisyData,
        discardData,
        sensorError,
      };
    }
    /* eslint-enable no-bitwise */
  }
}

class BloodGlucoseReadingEvent extends NGPHistoryEvent {
  static get BG_UNITS() {
    return {
      MG_DL: 0,
      MMOL_L: 1,
    };
  }

  static get BG_SOURCE() {
    return {
      EXTERNAL_METER: 1,
      BOLUS_WIZARD: 2,
      BG_EVENT_MARKER: 3,
      SENSOR_CAL: 4,
    };
  }

  get meterSerialNumber() {
    return this.eventData.slice(0x0F, this.eventData.length).toString().split('').reverse()
      .join('');
  }

  get bgSource() {
    return this.eventData[0x0E];
  }

  get bgValue() {
    // bgValue is always in mg/dL.
    return this.eventData.readUInt16BE(0x0C);
  }

  get bgUnits() {
    // bgValue is always in mg/dL. bgUnits tells us which units the device is set in.
    // eslint-disable-next-line no-bitwise
    return this.eventData[0x0B] & 1 ? 0 : 1;
  }

  get bgLinked() {
    return this.meterSerialNumber !== ' '.repeat(10);
  }

  get calibrationFlag() {
    // eslint-disable-next-line no-bitwise
    return (this.eventData[0x0B] & 2) === 2;
  }
}

class BasalSegmentStartEvent extends NGPHistoryEvent {
  static get PATTERN_NAME() {
    return [
      'Pattern 1',
      'Pattern 2',
      'Pattern 3',
      'Pattern 4',
      'Pattern 5',
      'Workday',
      'Day Off',
      'Sick Day',
    ];
  }

  get rate() {
    return this.eventData.readUInt32BE(0x0D) / 10000.0;
  }

  get patternNumber() {
    return this.eventData[0x0B];
  }

  get patternName() {
    return BasalSegmentStartEvent.PATTERN_NAME[this.patternNumber - 1];
  }

  get segmentNumber() {
    return this.eventData[0x0C];
  }
}

class TempBasalCompleteEvent extends NGPHistoryEvent {
  static get TEMP_BASAL_TYPE() {
    return {
      ABSOLUTE: 0,
      PERCENT: 1,
    };
  }


  static get MANUAL_TEMP_BASAL_TYPE() {
    return [
      'Not Preset',
      'Temp 1',
      'Temp 2',
      'Temp 3',
      'Temp 4',
      'High Activity',
      'Moderate Activity',
      'Low Activity',
      'Sick',
    ];
  }

  get rate() {
    return this.eventData.readUInt32BE(0x0D) / 10000.0;
  }

  get percentageOfRate() {
    return this.eventData[0x11];
  }

  get duration() {
    // TODO - add adjustTempBasalDuration() method for when canceled() is true!
    return this.eventData.readUInt16BE(0x12) * 60;
  }

  get canceled() {
    // eslint-disable-next-line no-bitwise
    return (this.eventData[0x14] & 1) === 1;
  }

  get type() {
    return this.eventData[0x0C];
  }

  get manualTempBasal() {
    return this.eventData[0x0B];
  }

  get manualTempBasalName() {
    return TempBasalCompleteEvent.MANUAL_TEMP_BASAL_TYPE[this.manualTempBasal];
  }
}

// No special attributes, but we'll keep this for Type recognition.
class RewindEvent extends NGPHistoryEvent {}

class CannulaFillDeliveredEvent extends NGPHistoryEvent {
  static get FILL_TYPE() {
    return {
      TUBING_FILL: 0,
      CANULLA_FILL: 1,
    };
  }

  get amount() {
    return this.eventData.readUInt32BE(0x0C) / 10000.0;
  }

  get type() {
    return this.eventData[0x0B];
  }

  get reservoirLevelRemaining() {
    return this.eventData.readUInt32BE(0x10) / 10000.0;
  }
}

class BolusDeliveredEvent extends NGPHistoryEvent {
  static get BOLUS_SOURCE() {
    return {
      MANUAL: 0,
      BOLUS_WIZARD: 1,
      EASY_BOLUS: 2,
      PRESET_BOLUS: 4,
    };
  }

  static get PRESET_BOLUS_NAME() {
    return [
      'Not Preset',
      'Bolus 1',
      'Bolus 2',
      'Bolus 3',
      'Bolus 4',
      'Breakfast',
      'Lunch',
      'Dinner',
      'Snack',
    ];
  }

  get bolusSource() {
    return this.eventData[0x0B];
  }

  get bolusNumber() {
    return this.eventData[0x0C];
  }

  get presetBolusNumber() {
    return this.eventData[0x0D];
  }
}

class NormalBolusDeliveredEvent extends BolusDeliveredEvent {
  get deliveredAmount() {
    return this.eventData.readUInt32BE(0x12) / 10000.0;
  }

  get programmedAmount() {
    return this.eventData.readUInt32BE(0x0E) / 10000.0;
  }

  get iob() {
    return this.eventData.readUInt32BE(0x16) / 10000.0;
  }
}

class SquareBolusDeliveredEvent extends BolusDeliveredEvent {
  get deliveredAmount() {
    return this.eventData.readUInt32BE(0x12) / 10000.0;
  }

  get programmedAmount() {
    return this.eventData.readUInt32BE(0x0E) / 10000.0;
  }

  get deliveredDuration() {
    return this.eventData.readUInt16BE(0x18);
  }

  get programmedDuration() {
    return this.eventData.readUInt16BE(0x16);
  }
}

class DualBolusPartDeliveredEvent extends BolusDeliveredEvent {
  static get DUAL_BOLUS_PART() {
    return {
      NORMAL_BOLUS: 1,
      SQUARE_WAVE: 2,
    };
  }

  get deliveredAmount() {
    return this.eventData.readUInt32BE(0x16) / 10000.0;
  }

  get normalProgrammedAmount() {
    return this.eventData.readUInt32BE(0x0E) / 10000.0;
  }

  get squareProgrammedAmount() {
    return this.eventData.readUInt32BE(0x12) / 10000.0;
  }

  get deliveredDuration() {
    return this.eventData.readUInt16BE(0x1D);
  }

  get programmedDuration() {
    return this.eventData.readUInt16BE(0x1B);
  }

  get bolusPart() {
    return this.eventData[0x1A];
  }

  get iob() {
    return this.eventData.readUInt32BE(0x1F) / 10000.0;
  }
}

class NGPHistoryParser {
  constructor(cfg, pages) {
    this.cfg = cfg;
    this.pages = pages;
    this.events = [];
  }

  // eslint-disable-next-line generator-star-spacing, Beautify adds it, and it's not terrible
  static * eventsFromPageString(pageString) {
    const page = Buffer.from(pageString, 'hex');
    let pos = 0;

    while (pos < page.length) {
      const eventSize = page[pos + 2];
      const eventData = page.slice(pos, pos + eventSize);
      pos += eventSize;
      yield new NGPHistoryEvent(eventData);
    }
  }

  * eventsOfType(eventType) {
    for (const event of this.events) {
      if (event.eventType === eventType) {
        yield event;
      }
    }
  }

  processData() {
    // Because we are converting data from this.pages to this.events, we consume the pages as we
    // process them to save on memory.
    const eventTypes = {}; // TODO - remove. Temporary while we're developing.
    while (this.pages.length > 0) {
      const page = this.pages.shift();
      for (const event of NGPHistoryParser.eventsFromPageString(page)) {
        if (eventTypes[event.eventType] === undefined) {
          eventTypes[event.eventType] = 0;
        }
        this.events.push(event.eventInstance());
        eventTypes[event.eventType] += 1;
      }
    }

    debug('*** Processed event types:');
    for (const key of Object.keys(eventTypes)) {
      debug(`    ${key}:`, eventTypes[key]);
    }

    return this;
  }

  buildCGMRecords(events) {
    for (const event of this.eventsOfType(
        NGPHistoryEvent.EVENT_TYPE.SENSOR_GLUCOSE_READINGS_EXTENDED)) {
      for (const reading of event.readings()) {
        if (reading.sg < 769) { // ignore magic numbers
          let record = this.cfg.builder.makeCBG()
            .with_value(reading.sg)
            .with_deviceTime(sundial.formatDeviceTime(reading.timestamp))
            .with_units('mg/dL')
            .with_payload({
              interstitialSignal: reading.isig,
            });
          this.cfg.tzoUtil.fillInUTCInfo(record, reading.timestamp);
          record = record.done();
          events.push(record);
        }
      }
    }

    return this;
  }

  buildBGRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.BG_READING)) {
      let reading = null;
      if (event.bgSource === BloodGlucoseReadingEvent.BG_SOURCE.SENSOR_CAL ||
        event.calibrationFlag) {
        reading = this.cfg.builder.makeDeviceEventCalibration()
          .with_deviceTime(sundial.formatDeviceTime(event.timestamp.toDate()))
          .with_units('mg/dL')
          .with_subType('calibration')
          .with_value(event.bgValue);
      } else {
        reading = this.cfg.builder.makeSMBG()
          .with_deviceTime(sundial.formatDeviceTime(event.timestamp.toDate()))
          .with_units('mg/dL')
          .with_subType(event.bgLinked ? 'linked' : 'manual')
          .with_value(event.bgValue);
      }

      if (event.bgLinked) {
        reading.with_payload({
          meterSerial: event.meterSerialNumber,
        });
      }

      this.cfg.tzoUtil.fillInUTCInfo(reading, event.timestamp.toDate());
      events.push(reading.done());
    }

    return this;
  }

  buildBasalRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.BASAL_SEGMENT_START)) {
      const basal = this.cfg.builder.makeScheduledBasal()
        .with_rate(event.rate)
        .with_deviceTime(sundial.formatDeviceTime(event.timestamp.toDate()))
        .with_scheduleName(event.patternName);

      this.cfg.tzoUtil.fillInUTCInfo(basal, event.timestamp.toDate());
      events.push(basal);
    }

    return this;
  }

  buildTempBasalRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.TEMP_BASAL_COMPLETE)) {
      // Since we're using the TEMP_BASAL_COMPLETE event, we need to get the Device timestamp
      // for the *beginning* of the event.
      const beginTimestamp = new Date(event.timestamp.toDate().getTime() -
        (event.duration * sundial.SEC_TO_MSEC));

      const suppressedBasal = this.findSuppressedBasal(event);

      // TODO - add adjustTempBasalDuration() method for when canceled() is true!
      const basal = this.cfg.builder.makeTempBasal()
        .with_deviceTime(sundial.formatDeviceTime(beginTimestamp))
        .with_rate(event.rate)
        .with_duration(event.duration * sundial.SEC_TO_MSEC)
        .set('suppressed', {
          type: 'basal',
          deliveryType: 'scheduled',
          rate: suppressedBasal.rate,
          scheduleName: suppressedBasal.patternName,
        });

      // We need to find the normal rate here to calculate event.rate, because
      // if it's a PERCENT record, event.rate will be 0.
      if (event.type === TempBasalCompleteEvent.TEMP_BASAL_TYPE.PERCENT) {
        basal
          .with_percent(event.percentageOfRate / 100.0)
          .with_rate(suppressedBasal.rate * (event.percentageOfRate / 100.0));
      }

      this.cfg.tzoUtil.fillInUTCInfo(basal, beginTimestamp);
      events.push(basal);

      // Now that the temp basal is complete, tack on the original basal schedule.
      const followUpBasal = this.cfg.builder.makeScheduledBasal()
        .with_rate(suppressedBasal.rate)
        .with_deviceTime(sundial.formatDeviceTime(event.timestamp.toDate()))
        .with_scheduleName(suppressedBasal.patternName);

      this.cfg.tzoUtil.fillInUTCInfo(followUpBasal, event.timestamp.toDate());
      events.push(followUpBasal);
    }

    return this;
  }

  findSuppressedBasal(tempBasal) {
    let tempBasalIndex = 0;
    // TODO - change *eventsOfType to return .entries() so that we already have the index.
    for (const [index, event] of this.events.entries()) {
      if (event === tempBasal) {
        tempBasalIndex = index;
        break;
      }
    }

    for (let i = tempBasalIndex; i > 0; i--) {
      const event = this.events[i];
      if (event.eventType === NGPHistoryEvent.EVENT_TYPE.BASAL_SEGMENT_START) {
        return event;
      }
    }

    return null;
  }

  buildNormalBolusRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.NORMAL_BOLUS_DELIVERED)) {
      const bolus = this.cfg.builder.makeNormalBolus()
        .with_deviceTime(sundial.formatDeviceTime(event.timestamp.toDate()))
        .with_normal(event.deliveredAmount);

      if (event.programmedAmount !== event.deliveredAmount) {
        bolus.with_expectedNormal(event.programmedAmount);
      }

      this.cfg.tzoUtil.fillInUTCInfo(bolus, event.timestamp.toDate());
      events.push(bolus.done());
    }
    return this;
  }

  buildSquareBolusRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.SQUARE_BOLUS_DELIVERED)) {
      // Since we're using the SQUARE_BOLUS_DELIVERED event, we need to get the Device timestamp
      // for the *beginning* of the event.
      const beginTimestamp = new Date(event.timestamp.toDate().getTime() -
        (event.deliveredDuration * sundial.MIN_TO_MSEC));
      const bolus = this.cfg.builder.makeSquareBolus()
        .with_deviceTime(sundial.formatDeviceTime(beginTimestamp))
        .with_duration(event.deliveredDuration * sundial.MIN_TO_MSEC)
        .with_extended(event.deliveredAmount);

      if (event.programmedAmount !== event.deliveredAmount ||
        event.programmedDuration !== event.deliveredDuration) {
        bolus.with_expectedExtended(event.programmedAmount)
          .with_expectedDuration(event.programmedDuration * sundial.MIN_TO_MSEC);
      }

      this.cfg.tzoUtil.fillInUTCInfo(bolus, event.timestamp.toDate());
      events.push(bolus.done());
    }
    return this;
  }

  buildDualBolusRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.DUAL_BOLUS_PART_DELIVERED)) {
      debug('*** DUAL BOLUS: ', event.eventData.toString('hex'), event.bolusPart, event.bolusNumber);
      /*
      const bolus = this.cfg.builder.makeDualBolus()
        .with_deviceTime(sundial.formatDeviceTime(event.timestamp.toDate()))
        .with_duration(event.deliveredDuration * sundial.MIN_TO_MSEC)
        .with_extended(event.deliveredAmount);

      if (event.programmedAmount !== event.deliveredAmount ||
        event.programmedDuration !== event.deliveredDuration) {
        bolus.with_expectedExtended(event.programmedAmount)
          .with_expectedDuration(event.programmedDuration * sundial.MIN_TO_MSEC);
      }

      this.cfg.tzoUtil.fillInUTCInfo(bolus, event.timestamp.toDate());
      events.push(bolus.done());
      */
    }
    return this;
  }

  buildRewindRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.REWIND)) {
      const rewind = this.cfg.builder.makeDeviceEventReservoirChange()
        .with_deviceTime(sundial.formatDeviceTime(event.timestamp.toDate()));
      this.cfg.tzoUtil.fillInUTCInfo(rewind, event.timestamp.toDate());

      events.push(rewind.done());
    }

    return this;
  }

  buildPrimeRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.CANNULA_FILL_DELIVERED)) {
      const prime = this.cfg.builder.makeDeviceEventPrime()
        .with_deviceTime(sundial.formatDeviceTime(event.timestamp.toDate()))
        .with_primeTarget(
          event.type === CannulaFillDeliveredEvent.FILL_TYPE.TUBING_FILL ? 'tubing' : 'cannula')
        .with_volume(event.amount);
      this.cfg.tzoUtil.fillInUTCInfo(prime, event.timestamp.toDate());

      events.push(prime.done());
    }

    return this;
  }
}

module.exports = NGPHistoryParser;
