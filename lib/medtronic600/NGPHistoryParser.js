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

const _ = require('lodash');
const sundial = require('sundial');
const NGPUtil = require('./NGPUtil');
const TZOUtil = require('../TimezoneOffsetUtil');

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
      case NGPHistoryEvent.EVENT_TYPE.USER_TIME_DATE_CHANGE:
        return new UserTimeDateEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.LOW_RESERVOIR:
        return new LowReservoirEvent(this.eventData);
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
      case NGPHistoryEvent.EVENT_TYPE.BOLUS_WIZARD_ESTIMATE:
        return new BolusWizardEstimateEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.INSULIN_DELIVERY_STOPPED:
        return new InsulinDeliveryStoppedEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.INSULIN_DELIVERY_RESTARTED:
        return new InsulinDeliveryRestartedEvent(this.eventData);
      default:
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

class UserTimeDateEvent extends NGPHistoryEvent {
  get newTimestamp() {
    return NGPUtil.NGPTimestamp.fromBuffer(this.eventData.slice(0x0B, 0x13));
  }
}

class LowReservoirEvent extends NGPHistoryEvent {
  // See NGPUtil.NGPConstants.RESERVOIR_WARNING_TYPE
  get warningType() {
    return this.eventData[0x0B];
  }

  get hoursRemaining() {
    return this.eventData[0x0C];
  }

  get minutesRemaining() {
    return this.eventData[0x0D];
  }

  get unitsRemaining() {
    return this.eventData.readUInt32BE(0x0E) / 10000.0;
  }

  get millisecondsRemaining() {
    return ((this.hoursRemaining * 60) + this.minutesRemaining) * sundial.MIN_TO_MSEC;
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

  * readings() {
    /* eslint-disable no-bitwise */
    let pos = 15;
    for (let i = 0; i < this.numberOfReadings; i++) {
      const timestamp = new NGPUtil.NGPTimestamp(this.timestamp.rtc -
        (i * this.minutesBetweenReadings * 60), this.timestamp.offset);
      const sg = ((this.eventData[pos] & 3) << 8) | this.eventData[pos + 1];
      const vctr = NGPUtil.make32BitIntFromNBitSignedInt(
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
  // Why is this string back to front, and space padded? ¯\_(ツ)_/¯
  get meterSerialNumber() {
    return this.eventData.slice(0x0F, this.eventData.length).toString().replace(' ', '').split('')
      .reverse()
      .join('');
  }

  // See NGPUtil.NGPConstants.BG_SOURCE
  get bgSource() {
    return this.eventData[0x0E];
  }

  get bgValue() {
    // bgValue is always in mg/dL.
    return this.eventData.readUInt16BE(0x0C);
  }

  // See NGPUtil.NGPConstants.BG_UNITS
  get bgUnits() {
    // bgValue is always in mg/dL. bgUnits tells us which units the device is set in.
    // eslint-disable-next-line no-bitwise
    return this.eventData[0x0B] & 1 ? 0 : 1;
  }

  get bgLinked() {
    return this.meterSerialNumber !== '';
  }

  get calibrationFlag() {
    // eslint-disable-next-line no-bitwise
    return (this.eventData[0x0B] & 2) === 2;
  }
}

class BasalSegmentStartEvent extends NGPHistoryEvent {
  get rate() {
    return this.eventData.readUInt32BE(0x0D) / 10000.0;
  }

  get patternNumber() {
    return this.eventData[0x0B];
  }

  get patternName() {
    return NGPUtil.NGPConstants.BASAL_PATTERN_NAME[this.patternNumber - 1];
  }

  get segmentNumber() {
    return this.eventData[0x0C];
  }
}

class TempBasalCompleteEvent extends NGPHistoryEvent {
  get rate() {
    return this.eventData.readUInt32BE(0x0D) / 10000.0;
  }

  get percentageOfRate() {
    return this.eventData[0x11];
  }

  get duration() {
    return this.eventData.readUInt16BE(0x12) * 60;
  }

  get canceled() {
    // eslint-disable-next-line no-bitwise
    return (this.eventData[0x14] & 1) === 1;
  }

  get type() {
    return this.eventData[0x0C];
  }

  get preset() {
    return this.eventData[0x0B];
  }

  get presetName() {
    return NGPUtil.NGPConstants.TEMP_BASAL_PRESET_NAME[this.preset];
  }
}

// No special attributes, but we'll keep this for Type recognition.
class RewindEvent extends NGPHistoryEvent {}

class CannulaFillDeliveredEvent extends NGPHistoryEvent {
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
  // See NGPUtil.NGPConstants.BOLUS_SOURCE
  get bolusSource() {
    return this.eventData[0x0B];
  }

  get bolusNumber() {
    return this.eventData[0x0C];
  }

  // See NGPUtil.NGPConstants.BOLUS_PRESET_NAME
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
  // deliveredAmount depends on bolusPart. If bolusPart == 1, this is the normal bolus portion.
  // if bolusPart == 2, this is the square wave portion.
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

  // See NGPUtil.NGPConstants.DUAL_BOLUS_PART
  get bolusPart() {
    return this.eventData[0x1A];
  }

  get iob() {
    return this.eventData.readUInt32BE(0x1F) / 10000.0;
  }
}

class BolusWizardEstimateEvent extends NGPHistoryEvent {
  // See NGPUtil.NGPConstants.BG_UNITS
  get bgUnits() {
    return this.eventData[0x0B];
  }

  // See NGPUtil.NGPConstants.CARB_UNITS
  get carbUnits() {
    return this.eventData[0x0C];
  }

  // See NGPUtil.NGPConstants.BOLUS_STEP_SIZE
  get bolusStepSize() {
    return this.eventData[0x2F];
  }

  get bgInput() {
    const bgInput = this.eventData.readUInt16BE(0x0D);
    return this.bgUnits === NGPUtil.NGPConstants.BG_UNITS.MG_DL ? bgInput : bgInput / 10.0;
  }

  get carbInput() {
    const carbs = this.eventData.readUInt16BE(0x0F);
    return this.carbUnits === NGPUtil.NGPConstants.CARB_UNITS.GRAMS ? carbs : carbs / 10.0;
  }

  get carbRatio() {
    const carbRatio = this.eventData.readUInt32BE(0x13);
    return this.carbUnits === NGPUtil.NGPConstants.CARB_UNITS.GRAMS ?
      carbRatio / 10.0 : carbRatio / 1000.0;
  }

  get isf() {
    const isf = this.eventData.readUInt16BE(0x11);
    return this.bgUnits === NGPUtil.NGPConstants.BG_UNITS.MG_DL ? isf : isf / 10.0;
  }

  get lowBgTarget() {
    const bgTarget = this.eventData.readUInt16BE(0x17);
    return this.bgUnits === NGPUtil.NGPConstants.BG_UNITS.MG_DL ? bgTarget : bgTarget / 10.0;
  }

  get highBgTarget() {
    const bgTarget = this.eventData.readUInt16BE(0x19);
    return this.bgUnits === NGPUtil.NGPConstants.BG_UNITS.MG_DL ? bgTarget : bgTarget / 10.0;
  }

  get correctionEstimate() {
    /* eslint-disable no-bitwise */
    return ((this.eventData[0x1B] << 8) |
      (this.eventData[0x1C] << 8) | (this.eventData[0x1D] << 8) | this.eventData[0x1E]) / 10000.0;
    /* eslint-enable no-bitwise */
  }

  get foodEstimate() {
    return this.eventData.readUInt32BE(0x1F) / 10000.0;
  }

  get iob() {
    return this.eventData.readUInt32BE(0x23) / 10000.0;
  }

  get iobAdjustment() {
    return this.eventData.readUInt32BE(0x27) / 10000.0;
  }

  get bolusWizardEstimate() {
    return this.eventData.readUInt32BE(0x2B) / 10000.0;
  }

  get finalEstimate() {
    return this.eventData.readUInt32BE(0x31) / 10000.0;
  }

  get estimateModifiedByUser() {
    // eslint-disable-next-line no-bitwise
    return (this.eventData.readUInt32BE(0x30) & 1) === 1;
  }
}

class InsulinDeliveryStoppedEvent extends NGPHistoryEvent {
  // See NGPUtil.NGPConstants.SUSPEND_REASON
  get suspendReason() {
    return this.eventData[0x0B];
  }
}

class InsulinDeliveryRestartedEvent extends NGPHistoryEvent {
  // See NGPUtil.NGPConstants.RESUME_REASON
  get resumeReason() {
    return this.eventData[0x0B];
  }
}

class NGPHistoryParser {
  constructor(cfg, pages) {
    this.cfg = cfg;
    this.events = [];

    this.processPages(pages);
  }

  processPages(pages) {
    // Consume the pages as we process them to save on memory.
    const eventTypes = {}; // TODO - remove. Temporary while we're developing.
    while (pages.length > 0) {
      const page = pages.shift();
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

  findMatchingDualBolusEvent(bolus) {
    let matchingBasalIndex = 0;
    // TODO - change *eventsOfType to return .entries() so that we already have the index.
    for (const [index, event] of this.events.entries()) {
      if (event === bolus) {
        matchingBasalIndex = index;
        break;
      }
    }

    for (let i = matchingBasalIndex; i < this.events.length; i++) {
      const event = this.events[i];
      if (event.eventType === NGPHistoryEvent.EVENT_TYPE.DUAL_BOLUS_PART_DELIVERED &&
        event.bolusPart === NGPUtil.NGPConstants.DUAL_BOLUS_PART.SQUARE_WAVE &&
        event.bolusNumber === bolus.bolusNumber) {
        return event;
      }
    }

    throw new Error('Matching dual bolus record not found');
  }

  findWizardForBolus(bolus, programmedAmount) {
    let matchingBolusIndex = 0;
    // TODO - change *eventsOfType to return .entries() so that we already have the index.
    for (const [index, event] of this.events.entries()) {
      if (event === bolus) {
        matchingBolusIndex = index;
        break;
      }
    }

    for (let i = matchingBolusIndex; i > 0; i--) {
      const event = this.events[i];
      if (event.eventType === NGPHistoryEvent.EVENT_TYPE.BOLUS_WIZARD_ESTIMATE &&
        bolus.bolusSource === NGPUtil.NGPConstants.BOLUS_SOURCE.BOLUS_WIZARD &&
        event.finalEstimate === programmedAmount) {
        return event;
      }
    }

    debug('Matching bolus wizard entry not found for bolus at', bolus.timestamp.toDate());
    throw new Error('Matching bolus wizard for bolus event not found');
  }

  findResumeForSuspend(suspend) {
    let matchingSuspendIndex = 0;
    // TODO - change *eventsOfType to return .entries() so that we already have the index.
    for (const [index, event] of this.events.entries()) {
      if (event === suspend) {
        matchingSuspendIndex = index;
        break;
      }
    }

    for (let i = matchingSuspendIndex; i < this.events.length; i++) {
      const event = this.events[i];
      if (event.eventType === NGPHistoryEvent.EVENT_TYPE.INSULIN_DELIVERY_RESTARTED) {
        return event;
      }
    }

    // It's possible that the pump is suspended during the upload, so no matching resume
    return null;
  }

  findTempBasalStartForComplete(tempBasalComplete) {
    let matchingBaslCompleteIndex = 0;
    // TODO - change *eventsOfType to return .entries() so that we already have the index.
    for (const [index, event] of this.events.entries()) {
      if (event === tempBasalComplete) {
        matchingBaslCompleteIndex = index;
        break;
      }
    }

    for (let i = matchingBaslCompleteIndex; i > 0; i--) {
      const event = this.events[i];
      if (event.eventType === NGPHistoryEvent.EVENT_TYPE.TEMP_BASAL_PROGRAMMED) {
        return event;
      }
    }

    throw new Error('Matching Temp Basal Start for Temp Basal Complete event not found');
  }

  addBtUtcFields(model, timestamp) {
    model.with_deviceTime(sundial.formatDeviceTime(timestamp.toDate()))
      .set('index', timestamp.rtc)
      .set('jsDate', timestamp.toDate());

    // Can't fill in UTCInfo for a time change records
    if (model.subType !== 'timeChange') {
      this.cfg.tzoUtil.fillInUTCInfo(model, timestamp.toDate());
    }

    return model;
  }

  buildTimeChangeRecords(mostRecent) {
    const timeChangeEvents = [];

    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.USER_TIME_DATE_CHANGE)) {
      const timeChange = this.cfg.builder.makeDeviceEventTimeChange()
        .with_change({
          from: event.timestamp.toDate(),
          to: event.newTimestamp.toDate(),
          agent: 'manual',
        });

      this.addBtUtcFields(timeChange, event.timestamp);

      timeChangeEvents.push(timeChange);
    }

    this.cfg.tzoUtil = new TZOUtil(this.cfg.timezone, mostRecent, timeChangeEvents);
    return {
      postRecords: this.cfg.tzoUtil.records,
      tzoUtil: this.cfg.tzoUtil,
    };
  }

  buildAlarmRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.LOW_RESERVOIR)) {
      const lowReservoir = this.cfg.builder.makeDeviceEventAlarm()
        .with_alarmType(event.unitsRemaining === 0.0 ? 'no_insulin' : 'low_insulin')
        .with_payload({
          amount: event.unitsRemaining,
          timeRemaining: event.millisecondsRemaining,
        });

      this.addBtUtcFields(lowReservoir, event.timestamp);
      events.push(lowReservoir);
    }

    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.LOW_BATTERY)) {
      const lowBattery = this.cfg.builder.makeDeviceEventAlarm()
        .with_alarmType(event.unitsRemaining === 0.0 ? 'no_insulin' : 'low_insulin')
        .with_payload({
          amount: event.unitsRemaining,
          timeRemaining: event.millisecondsRemaining,
        });

      this.addBtUtcFields(lowBattery, event.timestamp);
      events.push(lowBattery);
    }

    return this;
  }

  buildCGMRecords(events) {
    for (const event of this.eventsOfType(
        NGPHistoryEvent.EVENT_TYPE.SENSOR_GLUCOSE_READINGS_EXTENDED)) {
      for (const reading of event.readings()) {
        if (reading.sg < 769) { // ignore magic numbers
          const record = this.cfg.builder.makeCBG()
            .with_value(reading.sg)
            .with_units('mg/dL')
            .with_payload({
              interstitialSignal: reading.isig,
            });
          this.addBtUtcFields(record, reading.timestamp);
          events.push(record.done());
        }
      }
    }

    return this;
  }

  buildBGRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.BG_READING)) {
      let reading = null;
      if (event.bgSource === NGPUtil.NGPConstants.BG_SOURCE.SENSOR_CAL ||
        event.calibrationFlag) {
        reading = this.cfg.builder.makeDeviceEventCalibration()
          .with_units('mg/dL')
          .with_subType('calibration')
          .with_value(event.bgValue);
      } else {
        reading = this.cfg.builder.makeSMBG()
          .with_units('mg/dL')
          .with_subType(event.bgLinked ? 'linked' : 'manual')
          .with_value(event.bgValue);
      }

      if (event.bgLinked) {
        reading.with_payload({
          meterSerial: event.meterSerialNumber,
        });
      }

      this.addBtUtcFields(reading, event.timestamp);

      events.push(reading.done());
    }

    return this;
  }

  buildBasalRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.BASAL_SEGMENT_START)) {
      const basal = this.cfg.builder.makeScheduledBasal()
        .with_rate(event.rate)
        .with_scheduleName(event.patternName);

      this.addBtUtcFields(basal, event.timestamp);

      events.push(basal);
    }

    return this;
  }

  buildTempBasalRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.TEMP_BASAL_COMPLETE)) {
      // Since we're using the TEMP_BASAL_COMPLETE event, we need to get the Device timestamp
      // for the *beginning* of the event.
      let beginTimestamp = new NGPUtil.NGPTimestamp(event.timestamp.rtc - event.duration,
        event.timestamp.offset);

      const suppressedBasal = this.findSuppressedBasal(event);

      // TODO - add adjustTempBasalDuration() method for when canceled() is true!
      const basal = this.cfg.builder.makeTempBasal()
        .with_rate(event.rate)
        .with_duration(event.duration * sundial.SEC_TO_MSEC)
        .set('suppressed', {
          type: 'basal',
          deliveryType: 'scheduled',
          rate: suppressedBasal.rate,
          scheduleName: suppressedBasal.patternName,
        });

      if (event.canceled) {
        const startTempBasal = this.findTempBasalStartForComplete(event);
        basal
          .with_duration(
            (event.timestamp.toDate().valueOf() - startTempBasal.timestamp.toDate().valueOf()));
        beginTimestamp = startTempBasal.timestamp;
      }

      // We need to find the normal rate here to calculate event.rate, because
      // if it's a PERCENT record, event.rate will be 0.
      if (event.type === NGPUtil.NGPConstants.TEMP_BASAL_TYPE.PERCENT) {
        basal
          .with_percent(event.percentageOfRate / 100.0)
          .with_rate(suppressedBasal.rate * (event.percentageOfRate / 100.0));
      }

      this.addBtUtcFields(basal, beginTimestamp);

      events.push(basal);

      // The next start basal segment start event doesn't happen for up to a minute after the
      // temp basal complete event, leaving small basal data gaps every time a temp basal finishes.
      // Now that the temp basal is complete, tack on the original basal schedule.
      const restoredBasal = this.cfg.builder.makeScheduledBasal()
        .with_rate(suppressedBasal.rate)
        .with_scheduleName(suppressedBasal.patternName);

      this.addBtUtcFields(restoredBasal, event.timestamp);

      events.push(restoredBasal);
    }

    return this;
  }

  buildSuspendResumeRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.INSULIN_DELIVERY_STOPPED)) {
      const suppressedBasal = this.findSuppressedBasal(event);
      const resumeEvent = this.findResumeForSuspend(event);

      const reason = {
        suspended: 'automatic',
        resumed: 'automatic',
      };

      if (event.suspendReason === NGPUtil.NGPConstants.SUSPEND_REASON.USER_SUSPEND ||
        event.suspendReason === NGPUtil.NGPConstants.SUSPEND_REASON.SET_CHANGE_SUSPEND) {
        reason.suspended = 'manual';
      }

      if (resumeEvent === null) {
        reason.resumed = 'not_resumed';
      } else if (
        resumeEvent.resumeReason === NGPUtil.NGPConstants.RESUME_REASON.USER_SELECTS_RESUME ||
        resumeEvent.resumeReason === NGPUtil.NGPConstants.RESUME_REASON.USER_CLEARS_ALARM) {
        reason.resumed = 'manual';
      }

      const payload = {
        suspended: {
          cause: NGPUtil.NGPConstants.SUSPEND_REASON_NAME[event.suspendReason],
        },
        resumed: {
          cause: resumeEvent === null ? 'not_resumed' : NGPUtil.NGPConstants.RESUME_REASON_NAME[resumeEvent.resumeReason],
        },
      };

      const duration = resumeEvent === null ? 0 : resumeEvent.timestamp.toDate().valueOf() -
        event.timestamp.toDate().valueOf();

      const suspended = this.cfg.builder.makeSuspendBasal()
        .with_duration(duration)
        .with_payload(payload);
      this.addBtUtcFields(suspended, event.timestamp);

      events.push(suspended);

      if (resumeEvent !== null) {
        const resume = this.cfg.builder.makeDeviceEventSuspendResume()
          .with_reason(reason)
          .with_duration(duration)
          .with_payload(payload);
        this.addBtUtcFields(resume, resumeEvent.timestamp);

        events.push(resume.done());

        // The next start basal segment start event doesn't happen after a suspend/resume.
        // Now that the pump has resumed, tack on the original basal schedule.
        const restoredBasal = this.cfg.builder.makeScheduledBasal()
          .with_rate(suppressedBasal.rate)
          .with_scheduleName(suppressedBasal.patternName);

        this.addBtUtcFields(restoredBasal, resumeEvent.timestamp);

        events.push(restoredBasal);
      }
    }

    return this;
  }

  buildNormalBolusRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.NORMAL_BOLUS_DELIVERED)) {
      const bolus = this.cfg.builder.makeNormalBolus()
        .with_normal(event.deliveredAmount);

      if (event.programmedAmount !== event.deliveredAmount) {
        bolus.with_expectedNormal(event.programmedAmount);
      }

      this.addBtUtcFields(bolus, event.timestamp);

      if (event.bolusSource === NGPUtil.NGPConstants.BOLUS_SOURCE.BOLUS_WIZARD) {
        // TODO - do we want to treat an unmatching BOLUS_WIZARD record as a normal bolus?
        // If so, we should do the same in buildSquareBolusRecords and buildDualBolusRecords
        const completeBolus = bolus.done();
        try {
          const wizardEvent = this.findWizardForBolus(event, event.programmedAmount);
          events.push(this.buildWizardRecord(wizardEvent, completeBolus));
        } catch (err) {
          events.push(completeBolus);
        }
      } else {
        events.push(bolus.done());
      }
    }
    return this;
  }

  buildSquareBolusRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.SQUARE_BOLUS_DELIVERED)) {
      // Since we're using the SQUARE_BOLUS_DELIVERED event, we need to get the Device timestamp
      // for the *beginning* of the event.
      const beginTimestamp = new NGPUtil.NGPTimestamp(event.timestamp.rtc - event.deliveredDuration,
        event.timestamp.offset);
      const bolus = this.cfg.builder.makeSquareBolus()
        .with_duration(event.deliveredDuration * sundial.MIN_TO_MSEC)
        .with_extended(event.deliveredAmount);

      if (event.programmedAmount !== event.deliveredAmount ||
        event.programmedDuration !== event.deliveredDuration) {
        bolus.with_expectedExtended(event.programmedAmount)
          .with_expectedDuration(event.programmedDuration * sundial.MIN_TO_MSEC);
      }

      this.addBtUtcFields(bolus, beginTimestamp);

      if (event.bolusSource === NGPUtil.NGPConstants.BOLUS_SOURCE.BOLUS_WIZARD) {
        const wizardEvent = this.findWizardForBolus(event, event.programmedAmount);
        events.push(this.buildWizardRecord(wizardEvent, bolus.done()));
      } else {
        events.push(bolus.done());
      }
    }
    return this;
  }

  buildDualBolusRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.DUAL_BOLUS_PART_DELIVERED)) {
      // There are 2 events for a dual bolus delivery - we only react to the first part,
      // and in processing that, find the second part to build the TP data.
      if (event.bolusPart === NGPUtil.NGPConstants.DUAL_BOLUS_PART.NORMAL_BOLUS) {
        const matchingBolus = this.findMatchingDualBolusEvent(event);

        const bolus = this.cfg.builder.makeDualBolus()
          .with_normal(event.deliveredAmount)
          .with_extended(matchingBolus.deliveredAmount)
          .with_duration(matchingBolus.deliveredDuration * sundial.MIN_TO_MSEC);

        if (event.normalProgrammedAmount !== event.deliveredAmount) {
          bolus
            .with_expectedNormal(event.normalProgrammedAmount);
        }

        if (matchingBolus.squareProgrammedAmount !== matchingBolus.deliveredAmount ||
          matchingBolus.programmedDuration !== matchingBolus.deliveredDuration) {
          bolus
            .with_expectedExtended(matchingBolus.squareProgrammedAmount)
            .with_expectedDuration(matchingBolus.programmedDuration * sundial.MIN_TO_MSEC);
        }

        this.addBtUtcFields(bolus, event.timestamp);

        if (event.bolusSource === NGPUtil.NGPConstants.BOLUS_SOURCE.BOLUS_WIZARD) {
          const wizardEvent = this.findWizardForBolus(event,
            event.normalProgrammedAmount + event.squareProgrammedAmount);
          events.push(this.buildWizardRecord(wizardEvent, bolus.done()));
        } else {
          events.push(bolus.done());
        }
      }
    }
    return this;
  }

  buildWizardRecord(wizardEvent, bolusRecord) {
    const wizardBolus = _.clone(bolusRecord);
    delete wizardBolus.jsDate;
    delete wizardBolus.index;

    const wizard = this.cfg.builder.makeWizard()
      .with_recommended({
        carb: wizardEvent.foodEstimate,
        correction: wizardEvent.iobAdjustment,
        net: wizardEvent.bolusWizardEstimate,
      })
      .with_bolus(wizardBolus)
      .with_carbInput(wizardEvent.carbInput)
      .with_insulinOnBoard(wizardEvent.iob)
      .with_insulinCarbRatio(wizardEvent.carbRatio)
      .with_insulinSensitivity(wizardEvent.isf)
      .with_bgTarget({
        low: wizardEvent.lowBgTarget,
        high: wizardEvent.highBgTarget,
      })
      .with_units(wizardEvent.bgUnits === NGPUtil.NGPConstants.MG_DL ? 'mg/dL' : 'mmol/L');

    if (wizardEvent.bgInput > 0) {
      wizard.with_bgInput(wizardEvent.bgInput);
    }

    this.addBtUtcFields(wizard, wizardEvent.timestamp);

    return wizard.done();
  }

  buildRewindRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.REWIND)) {
      const rewind = this.cfg.builder.makeDeviceEventReservoirChange();

      this.addBtUtcFields(rewind, event.timestamp);


      events.push(rewind.done());
    }

    return this;
  }

  buildPrimeRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.CANNULA_FILL_DELIVERED)) {
      const prime = this.cfg.builder.makeDeviceEventPrime()
        .with_primeTarget(
          event.type === NGPUtil.NGPConstants.CANNULA_FILL_TYPE.TUBING_FILL ? 'tubing' : 'cannula')
        .with_volume(event.amount);

      this.addBtUtcFields(prime, event.timestamp);

      events.push(prime.done());
    }

    return this;
  }
}

module.exports = NGPHistoryParser;
