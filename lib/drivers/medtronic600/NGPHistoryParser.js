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

// I *like* for..in
/* eslint no-restricted-syntax: [0, "ForInStatement"] */

const _ = require('lodash');
const sundial = require('sundial');
const NGPUtil = require('./NGPUtil');
const TZOUtil = require('../../TimezoneOffsetUtil');
const annotate = require('../../eventAnnotations');

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('Medtronic600Driver') : console.log;

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
      CLOSED_LOOP_STATUS_DATA: 0x0C,
      CLOSED_LOOP_PERIODIC_DATA: 0x0D,
      CLOSED_LOOP_DAILY_DATA: 0x0E,
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
      FOOD_EVENT_MARKER: 0x2E,
      EXERCISE_EVENT_MARKER: 0x2F,
      INJECTION_EVENT_MARKER: 0x30,
      OTHER_EVENT_MARKER: 0x31,
      BG_READING: 0x32,
      CODE_UPDATE: 0x33,
      MISSED_MEAL_BOLUS_REMINDER_EXPIRED: 0x34,
      REWIND: 0x36,
      BATTERY_REMOVED: 0x37,
      CALIBRATION_COMPLETE: 0x38,
      ACTIVE_INSULIN_CLEARED: 0x39,
      DAILY_TOTALS: 0x3C,
      BOLUS_WIZARD_ESTIMATE: 0x3D,
      MEAL_WIZARD_ESTIMATE: 0x3E,
      CLOSED_LOOP_DAILY_TOTALS: 0x3F,
      USER_SETTINGS_SAVE: 0x50,
      USER_SETTINGS_RESET_TO_DEFAULTS: 0x51,
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
      CLOSED_LOOP_BG_READING: 0x82,
      CLOSED_LOOP_OPTION_CHANGE: 0x86,
      CLOSED_LOOP_SETTINGS_CHANGED: 0x87,
      CLOSED_LOOP_TEMP_TARGET_STARTED: 0x88,
      CLOSED_LOOP_TEMP_TARGET_ENDED: 0x89,
      CLOSED_LOOP_ALARM_AUTO_CLEARED: 0x8A,
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
      CLOSED_LOOP_TRANSITION: 0xDF,
    };
  }

  // The difference between the __BOLUS_PROGRAMMED and *_BOLUS_DELIVERED event types
  static get BOLUS_EVENT_PROGRAMMED_DELIVERED_GAP() {
    return 199;
  }

  constructor(eventData) {
    this.eventData = eventData;
  }

  get source() {
    // No idea what "source" means.
    // eslint-disable-next-line no-bitwise
    return (this.eventData[0x01] & 127);
  }

  get isClosedLoopActive() {
    // eslint-disable-next-line no-bitwise
    return (this.eventData[0x01] & 128) >> 7 === 1;
  }

  get size() {
    return this.eventData[0x02];
  }

  get eventType() {
    return this.eventData[0];
  }

  // TODO: - make this a static factory (passing in eventData)?
  // Doing it this way causes double-initialisation
  eventInstance() {
    /* eslint-disable no-use-before-define */
    switch (this.eventType) {
      case NGPHistoryEvent.EVENT_TYPE.OLD_BOLUS_WIZARD_BG_TARGETS:
        return new OldBolusWizardBgTargetsEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.NEW_BOLUS_WIZARD_BG_TARGETS:
        return new NewBolusWizardBgTargetsEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.OLD_BOLUS_WIZARD_INSULIN_SENSITIVITY:
        return new OldBolusWizardInsulinSensitivityEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.NEW_BOLUS_WIZARD_INSULIN_SENSITIVITY:
        return new NewBolusWizardInsulinSensitivityEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.OLD_BOLUS_WIZARD_INSULIN_TO_CARB_RATIOS:
        return new OldBolusWizardCarbsRatiosEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.NEW_BOLUS_WIZARD_INSULIN_TO_CARB_RATIOS:
        return new NewBolusWizardCarbsRatiosEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.OLD_BASAL_PATTERN:
        return new OldBasalPatternEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.NEW_BASAL_PATTERN:
        return new NewBasalPatternEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.BASAL_PATTERN_SELECTED:
        return new BasalPatternSelectedEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.TIME_RESET:
        return new TimeChangeEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.USER_TIME_DATE_CHANGE:
        return new TimeChangeEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.ALARM_NOTIFICATION:
        return new AlarmNotificationEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.LOW_RESERVOIR:
        return new LowReservoirEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.SENSOR_GLUCOSE_READINGS_EXTENDED:
        return new SensorGlucoseReadingsEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.BG_READING:
        return new BloodGlucoseReadingEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.CLOSED_LOOP_BG_READING:
        return new ClosedLoopBloodGlucoseReadingEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.CLOSED_LOOP_TRANSITION:
        return new ClosedLoopTransitionEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.BASAL_SEGMENT_START:
        return new BasalSegmentStartEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.TEMP_BASAL_PROGRAMMED:
        return new TempBasalProgrammedEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.TEMP_BASAL_COMPLETE:
        return new TempBasalCompleteEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.REWIND:
        return new RewindEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.CANNULA_FILL_DELIVERED:
        return new CannulaFillDeliveredEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.NORMAL_BOLUS_PROGRAMMED:
        return new BolusEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.NORMAL_BOLUS_DELIVERED:
        return new NormalBolusDeliveredEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.SQUARE_BOLUS_DELIVERED:
        return new SquareBolusDeliveredEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.SQUARE_BOLUS_PROGRAMMED:
        return new BolusEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.DUAL_BOLUS_PART_DELIVERED:
        return new DualBolusPartDeliveredEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.DUAL_BOLUS_PROGRAMMED:
        return new BolusEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.BOLUS_WIZARD_ESTIMATE:
        return new BolusWizardEstimateEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.MEAL_WIZARD_ESTIMATE:
        return new MealWizardEstimateEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.INSULIN_DELIVERY_STOPPED:
        return new InsulinDeliveryStoppedEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.INSULIN_DELIVERY_RESTARTED:
        return new InsulinDeliveryRestartedEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.CALIBRATION_COMPLETE:
        return new CalibrationCompleteEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.MAX_BASAL_RATE_CHANGE:
        return new MaxBasalRateChangeEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.MAX_BOLUS_CHANGE:
        return new MaxBolusChangeEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.DUAL_BOLUS_OPTION_CHANGE:
        return new DualBolusOptionChangeEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.SQUARE_BOLUS_OPTION_CHANGE:
        return new SquareBolusOptionChangeEvent(this.eventData);
      case NGPHistoryEvent.EVENT_TYPE.BOLUS_WIZARD_SETTINGS_CHANGE:
        return new BolusWizardSettingsChangeEvent(this.eventData);
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

class TimeChangeEvent extends NGPHistoryEvent {
  get newTimestamp() {
    return NGPUtil.NGPTimestamp.fromBuffer(this.eventData.slice(0x0B, 0x13));
  }
}

class AlarmNotificationEvent extends NGPHistoryEvent {
  get notificationMode() {
    return this.eventData[0x11];
  }

  get faultNumber() {
    return this.eventData.readUInt16BE(0x0B);
  }

  get extraData() {
    // eslint-disable-next-line no-bitwise
    return this.eventData[0x12] & 2;
  }

  get alarmHistory() {
    // eslint-disable-next-line no-bitwise
    return this.eventData[0x12] & 4;
  }

  get alarmData() {
    return this.eventData.slice(0x13, 0x1c).toString('hex');
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
      const rawVcntr = (((this.eventData[pos] >> 2) & 3) << 8) | this.eventData[pos + 4];
      const vctr = NGPUtil.make32BitIntFromNBitSignedInt(rawVcntr, 10) / 100.0;
      const isig = this.eventData.readInt16BE(pos + 2) / 100.0;
      const rateOfChange = this.eventData.readInt16BE(pos + 5) / 100.0;
      const readingStatus = this.eventData[pos + 8];
      const sensorStatus = this.eventData[pos + 7];

      const backfilledData = (readingStatus & 1) === 1;
      const settingsChanged = (readingStatus & 2) === 1;
      const noisyData = sensorStatus === 1;
      const discardData = sensorStatus === 2;
      const sensorError = sensorStatus === 3;
      // TODO: - handle all the error states where sg >= 769 (see ParseCGM.js)?

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

class CalibrationCompleteEvent extends NGPHistoryEvent {
  get bgValue() {
    // bgValue is always in mg/dL.
    return this.eventData.readUInt16BE(0x0D);
  }

  get calFactor() {
    return this.eventData.readUInt16BE(0x0B) / 100.0;
  }
}

class BloodGlucoseReadingEvent extends NGPHistoryEvent {
  // Why is this string back to front, and space padded? ¯\_(ツ)_/¯
  get meterSerialNumber() {
    return _.chain(this.eventData.slice(0x0F, this.eventData.length).toString())
      .replace(' ', '').split('').reverse()
      .join('')
      .trim()
      .value();
  }

  // See NGPUtil.NGPConstants.BG_SOURCE
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
    return this.eventData[0x0B] & 1 ?
      NGPUtil.NGPConstants.BG_UNITS.MG_DL :
      NGPUtil.NGPConstants.BG_UNITS.MMOL_L;
  }

  get calibrationFlag() {
    // eslint-disable-next-line no-bitwise
    return (this.eventData[0x0B] & 2) === 2;
  }

  get bgLinked() {
    return this.meterSerialNumber !== '';
  }
}

class ClosedLoopBloodGlucoseReadingEvent extends NGPHistoryEvent {
  get bgValue() {
    // bgValue is always in mg/dL.
    return this.eventData.readUInt16BE(0x0B);
  }

  get bgUnits() {
    // bgValue is always in mg/dL. bgUnits tells us which units the device is set in.
    // eslint-disable-next-line no-bitwise
    return this.eventData[0x16] & 1 ?
      NGPUtil.NGPConstants.BG_UNITS.MMOL_L :
      NGPUtil.NGPConstants.BG_UNITS.MG_DL;
  }

  get bgReadingOrigin() {
    // eslint-disable-next-line no-bitwise
    return this.eventData[0x16] & 2 ?
      NGPUtil.NGPConstants.BG_ORIGIN.RECEIVED_FROM_RF :
      NGPUtil.NGPConstants.BG_ORIGIN.MANUALLY_ENTERED;
  }

  // See NGPUtil.NGPConstants.BG_CONTEXT
  get bgReadingContext() {
    // eslint-disable-next-line no-bitwise
    return (this.eventData[0x16] & 248) >> 3;
  }

  get bgLinked() {
    return this.bgReadingOrigin === NGPUtil.NGPConstants.BG_ORIGIN.RECEIVED_FROM_RF;
  }

  isFirstReading() {
    return (this.bgReadingOrigin === NGPUtil.NGPConstants.BG_ORIGIN.RECEIVED_FROM_RF &&
          this.bgReadingContext === NGPUtil.NGPConstants.BG_CONTEXT.BG_READING_RECEIVED) ||
        (this.bgReadingOrigin === NGPUtil.NGPConstants.BG_ORIGIN.MANUALLY_ENTERED &&
          this.bgReadingContext >= NGPUtil.NGPConstants.BG_CONTEXT.ENTERED_IN_BG_ENTRY);
  }
}

class ClosedLoopTransitionEvent extends NGPHistoryEvent {
  // See NGPUtil.NGPConstants.CL_TRANSITION_VALUE
  get transitionValue() {
    return this.eventData[0x0B];
  }

  // See NGPUtil.NGPConstants.CL_TRANSITION_REASON
  get transitionReason() {
    return this.eventData[0x0C];
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

class TempBasalProgrammedEvent extends NGPHistoryEvent {
  get rate() {
    return this.eventData.readUInt32BE(0x0D) / 10000.0;
  }

  get percentageOfRate() {
    return this.eventData[0x11];
  }

  get expectedDuration() {
    return this.eventData.readUInt16BE(0x12) * sundial.MIN_TO_MSEC;
  }

  // See NGPUtil.NGPConstants.TEMP_BASAL_TYPE
  get type() {
    return this.eventData[0x0C];
  }

  // See NGPUtil.NGPConstants.TEMP_BASAL_PRESET_NAME
  get preset() {
    return this.eventData[0x0B];
  }

  get presetName() {
    return NGPUtil.NGPConstants.TEMP_BASAL_PRESET_NAME[this.preset];
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
    if (this.size < 23) {
      return this.eventData.readUInt16BE(0x12) * sundial.MIN_TO_MSEC;
    }
    return this.eventData.readUInt16BE(0x15) * sundial.MIN_TO_MSEC;
  }

  get canceled() {
    // eslint-disable-next-line no-bitwise
    return (this.eventData[0x14] & 1) === 1;
  }

  // See NGPUtil.NGPConstants.TEMP_BASAL_TYPE
  get type() {
    return this.eventData[0x0C];
  }

  // See NGPUtil.NGPConstants.TEMP_BASAL_PRESET_NAME
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

class BolusEvent extends NGPHistoryEvent {
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

  isWizardBolus() {
    return _.includes([
      NGPUtil.NGPConstants.BOLUS_SOURCE.BOLUS_WIZARD,
      NGPUtil.NGPConstants.BOLUS_SOURCE.CLOSED_LOOP_BG_CORRECTION,
      NGPUtil.NGPConstants.BOLUS_SOURCE.CLOSED_LOOP_FOOD_BOLUS,
      NGPUtil.NGPConstants.BOLUS_SOURCE.CLOSED_LOOP_BG_CORRECTION_AND_FOOD_BOLUS,
    ], this.bolusSource);
  }
}

class NormalBolusDeliveredEvent extends BolusEvent {
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

class SquareBolusDeliveredEvent extends BolusEvent {
  get deliveredAmount() {
    return this.eventData.readUInt32BE(0x12) / 10000.0;
  }

  get programmedAmount() {
    return this.eventData.readUInt32BE(0x0E) / 10000.0;
  }

  get deliveredDuration() {
    return this.eventData.readUInt16BE(0x18) * 60;
  }

  get programmedDuration() {
    return this.eventData.readUInt16BE(0x16) * 60;
  }
}

class DualBolusPartDeliveredEvent extends BolusEvent {
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
    return this.eventData.readUInt16BE(0x1D) * 60;
  }

  get programmedDuration() {
    return this.eventData.readUInt16BE(0x1B) * 60;
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

  get wizardEstimate() {
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

class MealWizardEstimateEvent extends NGPHistoryEvent {
  // See NGPUtil.NGPConstants.BG_UNITS
  get bgUnits() {
    // eslint-disable-next-line no-bitwise
    return this.eventData[0x0B] & 1;
  }

  // See NGPUtil.NGPConstants.CARB_UNITS
  get carbUnits() {
    // eslint-disable-next-line no-bitwise
    return this.eventData[0x0B] & 2;
  }

  // See NGPUtil.NGPConstants.BOLUS_STEP_SIZE
  get bolusStepSize() {
    return this.eventData[0x2F];
  }

  get bgInput() {
    const bgInput = this.eventData.readUInt16BE(0x0C);
    return this.bgUnits === NGPUtil.NGPConstants.BG_UNITS.MG_DL ? bgInput : bgInput / 10.0;
  }

  get carbInput() {
    const carbs = this.eventData.readUInt16BE(0x0E);
    return this.carbUnits === NGPUtil.NGPConstants.CARB_UNITS.GRAMS ? carbs : carbs / 10.0;
  }

  get carbRatio() {
    const carbRatio = this.eventData.readUInt32BE(0x1C);
    return this.carbUnits === NGPUtil.NGPConstants.CARB_UNITS.GRAMS ?
      carbRatio / 10.0 : carbRatio / 1000.0;
  }

  get correctionEstimate() {
    return this.eventData.readUInt32BE(0x10) / 10000.0;
  }

  get foodEstimate() {
    return this.eventData.readUInt32BE(0x14) / 10000.0;
  }

  get wizardEstimate() {
    return this.eventData.readUInt32BE(0x18) / 10000.0;
  }

  get finalEstimate() {
    // The user can't modify the amount to be delivered in a MealWizard
    return this.wizardEstimate;
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

class BolusWizardInsulinSensitivityEvent extends NGPHistoryEvent {
  // See NGPUtil.NGPConstants.BG_UNITS
  get units() {
    return this.eventData[0x0B];
  }

  get numberOfSegments() {
    return this.eventData[0x0C];
  }

  isfs() {
    const isfs = [];

    let pos = 13;
    for (let i = 0; i < this.numberOfSegments; i++) {
      const start = this.eventData[pos] * 30 * sundial.MIN_TO_MSEC;
      const amount = this.eventData.readInt16BE(pos + 1);

      pos += 3;

      isfs.push({
        start,
        amount: this.units === NGPUtil.NGPConstants.BG_UNITS.MG_DL ? amount : amount / 10.0,
      });
    }

    return isfs;
  }
}
class OldBolusWizardInsulinSensitivityEvent extends BolusWizardInsulinSensitivityEvent {}
class NewBolusWizardInsulinSensitivityEvent extends BolusWizardInsulinSensitivityEvent {}

class BolusWizardCarbsRatiosEvent extends NGPHistoryEvent {
  // See NGPUtil.NGPConstants.CARB_UNITS
  get units() {
    return this.eventData[0x0B];
  }

  get numberOfSegments() {
    return this.eventData[0x0C];
  }

  carbRatios() {
    const carbRatios = [];

    let pos = 13;
    for (let i = 0; i < this.numberOfSegments; i++) {
      const start = this.eventData[pos] * 30 * sundial.MIN_TO_MSEC;
      const amount = this.eventData.readInt32BE(pos + 1);

      pos += 5;

      carbRatios.push({
        start,
        amount: this.units === NGPUtil.NGPConstants.CARB_UNITS.GRAMS ?
          amount / 10.0 : amount / 1000.0,
      });
    }

    return carbRatios;
  }
}
class OldBolusWizardCarbsRatiosEvent extends BolusWizardCarbsRatiosEvent {}
class NewBolusWizardCarbsRatiosEvent extends BolusWizardCarbsRatiosEvent {}

class BolusWizardBgTargetsEvent extends NGPHistoryEvent {
  // See NGPUtil.NGPConstants.BG_UNITS
  get units() {
    return this.eventData[0x0B];
  }

  get numberOfSegments() {
    return this.eventData[0x0C];
  }

  bgTargets() {
    const targets = [];

    let pos = 13;
    for (let i = 0; i < this.numberOfSegments; i++) {
      const start = this.eventData[pos] * 30 * sundial.MIN_TO_MSEC;
      const high = this.eventData.readInt16BE(pos + 1);
      const low = this.eventData.readInt16BE(pos + 3);

      pos += 5;

      targets.push({
        start,
        low: this.units === NGPUtil.NGPConstants.BG_UNITS.MG_DL ?
          low : low / 10.0,
        high: this.units === NGPUtil.NGPConstants.BG_UNITS.MG_DL ?
          high : high / 10.0,
      });
    }

    return targets;
  }
}
class OldBolusWizardBgTargetsEvent extends BolusWizardBgTargetsEvent {}
class NewBolusWizardBgTargetsEvent extends BolusWizardBgTargetsEvent {}

class BasalPatternEvent extends NGPHistoryEvent {
  get patternNumber() {
    return this.eventData[0x0B];
  }

  get patternName() {
    return NGPUtil.NGPConstants.BASAL_PATTERN_NAME[this.patternNumber - 1];
  }

  get numberOfSegments() {
    return this.eventData[0x0C];
  }

  patterns() {
    const patterns = [];

    let pos = 13;
    for (let i = 0; i < this.numberOfSegments; i++) {
      const rate = this.eventData.readInt32BE(pos) / 10000.0;
      const start = this.eventData[pos + 4] * 30 * sundial.MIN_TO_MSEC;

      pos += 5;

      patterns.push({
        start,
        rate,
      });
    }

    return patterns;
  }
}
class OldBasalPatternEvent extends BasalPatternEvent {}
class NewBasalPatternEvent extends BasalPatternEvent {}

class BasalPatternSelectedEvent extends NGPHistoryEvent {
  get oldPatternNumber() {
    return this.eventData[0x0B];
  }

  get oldPatternName() {
    return NGPUtil.NGPConstants.BASAL_PATTERN_NAME[this.oldPatternNumber - 1];
  }

  get newPatternNumber() {
    return this.eventData[0x0C];
  }

  get newPatternName() {
    return NGPUtil.NGPConstants.BASAL_PATTERN_NAME[this.newPatternNumber - 1];
  }
}

class MaxChangeEvent extends NGPHistoryEvent {
  get oldValue() {
    return this.eventData.readInt32BE(11) / 10000.0;
  }

  get newValue() {
    return this.eventData.readInt32BE(15) / 10000.0;
  }
}
class MaxBasalRateChangeEvent extends MaxChangeEvent {}
class MaxBolusChangeEvent extends MaxChangeEvent {}

class BolusOptionChangeEvent extends NGPHistoryEvent {
  get oldOptionChange() {
    return this.eventData[11];
  }

  get newOptionChange() {
    return this.eventData[12];
  }
}
class SquareBolusOptionChangeEvent extends BolusOptionChangeEvent {}
class DualBolusOptionChangeEvent extends BolusOptionChangeEvent {}

class BolusWizardSettingsChangeEvent extends NGPHistoryEvent {
  get oldEnabled() {
    return this.eventData[11] === 1;
  }

  get newEnabled() {
    return this.eventData[15] === 1;
  }

  get oldCarbUnits() {
    return this.eventData[12] ===
      NGPUtil.NGPConstants.CARB_UNITS.EXCHANGES ?
      'exchanges' : 'grams';
  }

  get newCarbUnits() {
    return this.eventData[16] ===
      NGPUtil.NGPConstants.CARB_UNITS.EXCHANGES ?
      'exchanges' : 'grams';
  }

  get oldDurationOfInsulinAction() {
    return this.eventData.readInt16BE(13);
  }

  get newDurationOfInsulinAction() {
    return this.eventData.readInt16BE(17);
  }
}

class NGPHistoryParser {
  constructor(cfg, currentPumpSettings, pages) {
    this.cfg = cfg;
    this.currentPumpSettings = currentPumpSettings;
    this.events = [];

    this.processPages(pages);
  }

  processPages(pages) {
    let skipTimeChange = false;
    // Consume the pages as we process them to save on memory.
    while (pages.length > 0) {
      const page = pages.shift();
      for (const event of NGPHistoryParser.eventsFromPageString(page)) {
        if (event.eventType === NGPHistoryEvent.EVENT_TYPE.TIME_RESET) {
          debug('TIME_RESET detected. Ignoring next USER_TIME_DATE_CHANGE.');
          skipTimeChange = true;
        }

        if (event.eventType === NGPHistoryEvent.EVENT_TYPE.USER_TIME_DATE_CHANGE &&
          skipTimeChange) {
          skipTimeChange = false;
          // eslint-disable-next-line no-continue
          continue;
        }

        this.events.push(event.eventInstance());
      }
    }
  }

  // eslint-disable-next-line generator-star-spacing
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

  * eventsOfType(...eventTypes) {
    for (const event of this.events) {
      if (_.includes(eventTypes, event.eventType)) {
        yield event;
      }
    }
  }

  * eventsOfTypeReverse(...eventTypes) {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const event = this.events[i];
      if (_.includes(eventTypes, event.eventType)) {
        yield event;
      }
    }
  }

  findMatchingClosedLoopBGReadings(bgReadingEvent) {
    // Find all of the ClosedLoopBloodGlucoseReadingEvents with the same BG value that
    // occurred within 15 minutes of the BG_READING_RECEIVED.
    const matchingReadings = [];
    let eventIndex = _.findIndex(this.events, event => event === bgReadingEvent) + 1;
    while (this.events.length > eventIndex &&
      this.events[eventIndex].timestamp.rtc < bgReadingEvent.timestamp.rtc + 900) {
      if (this.events[eventIndex].eventType ===
        NGPHistoryEvent.EVENT_TYPE.CLOSED_LOOP_BG_READING) {
        if (this.events[eventIndex].isFirstReading()) {
          break;
        } else if (this.events[eventIndex].bgValue === bgReadingEvent.bgValue) {
          matchingReadings.push(this.events[eventIndex]);
        }
      }
      eventIndex += 1;
    }
    return matchingReadings;
  }

  findSmbgForCalibration(calibrationEvent) {
    const calibrationIndex = _.findIndex(this.events, event => event === calibrationEvent);

    return _.findLast(
      this.events, item => (item.eventType === NGPHistoryEvent.EVENT_TYPE.BG_READING ||
        (item.eventType === NGPHistoryEvent.EVENT_TYPE.CLOSED_LOOP_BG_READING &&
          item.isFirstReading())) &&
        item.bgValue === calibrationEvent.bgValue
      , calibrationIndex,
    );
  }

  // This is here because a Temp Basal with a percentage requires the suppressed basal
  // to determine the rate. Though this could also be done in the simulator, we do it here
  // because the event is incomplete without the rate.
  findSuppressedBasal(tempBasal) {
    const tempBasalIndex = _.findIndex(this.events, event => event === tempBasal);

    return _.findLast(
      this.events, item => item.eventType === NGPHistoryEvent.EVENT_TYPE.BASAL_SEGMENT_START
      , tempBasalIndex,
    );
  }

  // This is here rather than in the simulator because the boluses both share a bolusNumber
  // as an identifier.
  getBeginTimestampForBolusDelivered(bolus) {
    const matchingBolusIndex = _.findIndex(this.events, event => event === bolus);

    const programmedBolus = _.findLast(
      this.events, event => event.eventType === bolus.eventType -
        NGPHistoryEvent.BOLUS_EVENT_PROGRAMMED_DELIVERED_GAP &&
      event.bolusNumber === bolus.bolusNumber &&
      event.timestamp.rtc > bolus.timestamp.rtc - 28800, // The longest a bolus can take is 8 hours
      matchingBolusIndex,
    );

    return _.isUndefined(programmedBolus) ? undefined : programmedBolus.timestamp;
  }

  getAutoModeStartGap(autoModeStartEvent) {
    const autoModeEventIndex = _.findIndex(this.events, event => event === autoModeStartEvent);

    const nextMicrobolus = _.find(
      this.events, event =>
        ((event.eventType === NGPHistoryEvent.EVENT_TYPE.NORMAL_BOLUS_DELIVERED &&
          event.bolusSource === NGPUtil.NGPConstants.BOLUS_SOURCE.CLOSED_LOOP_MICRO_BOLUS) ||
        event.eventType === NGPHistoryEvent.EVENT_TYPE.BASAL_SEGMENT_START),
      autoModeEventIndex,
    );

    return _.isUndefined(nextMicrobolus) ? 0 :
      (nextMicrobolus.timestamp.rtc - autoModeStartEvent.timestamp.rtc) * 1000;
  }

  // This is here rather than in the simulator because the boluses both share a bolusNumber
  // as an identifier.
  findMatchingDualBolusEvent(bolus) {
    const matchingBolusIndex = _.findIndex(this.events, event => event === bolus);

    return _.find(
      this.events, event =>
        (event.eventType === NGPHistoryEvent.EVENT_TYPE.DUAL_BOLUS_PART_DELIVERED &&
        event.bolusPart === NGPUtil.NGPConstants.DUAL_BOLUS_PART.SQUARE_WAVE &&
        event.bolusNumber === bolus.bolusNumber),
      matchingBolusIndex,
    );
  }

  // This is done in the parser rather than in the simulator, because the bolus has a bolusSource
  // to specify that it matches a Wizard event.
  findWizardForBolus(bolus, programmedAmount) {
    const matchingBolusIndex = _.findIndex(this.events, event => event === bolus);

    const wizardIndex = _.findLastIndex(
      this.events,
      event => (event.eventType === NGPHistoryEvent.EVENT_TYPE.BOLUS_WIZARD_ESTIMATE ||
        event.eventType === NGPHistoryEvent.EVENT_TYPE.MEAL_WIZARD_ESTIMATE) &&
      bolus.isWizardBolus() && event.finalEstimate === programmedAmount,
      matchingBolusIndex,
    );

    const wizard = this.events[wizardIndex];
    // remove the found wizard from the array so that we know which
    // wizard events do not have matching boluses
    _.pullAt(this.events, wizardIndex);

    return wizard;
  }

  findResumeForSuspend(suspend) {
    const matchingSuspendIndex = _.findIndex(this.events, event => event === suspend);

    // It would be nice to use _.find here, but lodash 3.10.1 doesn't support fromIndex
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
    const matchingBasalCompleteIndex =
      _.findIndex(this.events, event => event === tempBasalComplete);

    // It would be nice to use _.findLast here, but lodash 3.10.1 doesn't support fromIndex
    for (let i = matchingBasalCompleteIndex; i >= 0; i--) {
      const event = this.events[i];
      if (event.eventType === NGPHistoryEvent.EVENT_TYPE.TEMP_BASAL_PROGRAMMED) {
        return event;
      }
    }

    // we don't know when this temp basal started, so have to ignore all basal events prior to this timestamp
    // since we won't know whether those basals are suppressed by the temp basal
    debug('Could not find start event for temp basal ending at', sundial.formatDeviceTime(tempBasalComplete.timestamp.toDate()));
    this.firstBasalTime = tempBasalComplete.timestamp;
    return undefined;
  }

  addTimeFields(model, timestamp) {
    model.with_deviceTime(sundial.formatDeviceTime(timestamp.toDate()))
      .set('index', timestamp.rtc)
      .set('jsDate', timestamp.toDate());

    // Can't fill in UTCInfo for a time change record
    if (model.subType !== 'timeChange') {
      this.cfg.tzoUtil.fillInUTCInfo(model, timestamp.toDate());
    }

    return model;
  }

  buildTimeChangeRecords() {
    const timeChangeEvents = [];

    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.USER_TIME_DATE_CHANGE)) {
      const timeChange = this.cfg.builder.makeDeviceEventTimeChange()
        .with_change({
          from: sundial.formatDeviceTime(event.timestamp.toDate()),
          to: sundial.formatDeviceTime(event.newTimestamp.toDate()),
          agent: 'manual',
        });

      this.addTimeFields(timeChange, event.newTimestamp);

      timeChangeEvents.push(timeChange);
    }

    const lastEvent = this.events[this.events.length - 1];
    this.cfg.tzoUtil = new TZOUtil(
      this.cfg.timezone, lastEvent.timestamp.toDate(),
      timeChangeEvents,
    );

    return {
      postRecords: this.cfg.tzoUtil.records,
      tzoUtil: this.cfg.tzoUtil,
    };
  }

  buildSettingsRecords(events) {
    // Determine if the pump is in 'Auto Mode' by looking at the most recent history event
    // and checking the Closed Loop state.
    // If the pump is not in Closed Loop, we keep the active basal pattern from the status message.
    const lastEvent = this.events[this.events.length - 1];
    if (lastEvent.isClosedLoopActive) {
      // Synthesize an empty basal schedule for Auto Mode
      this.currentPumpSettings.basalSchedules['Auto Mode'] = [];
      this.currentPumpSettings.activeSchedule = 'Auto Mode';
    }

    // Start with current settings, and work our way backwards in time to build settings change
    // snapshots.
    const currentNgpTimestamp = new NGPUtil.NGPTimestamp(
      this.currentPumpSettings.currentNgpTimestamp.rtc,
      this.currentPumpSettings.currentNgpTimestamp.offset,
    );
    const currentSettings = this.cfg.builder.makePumpSettings();
    currentSettings
      .with_time(currentNgpTimestamp.toDate().toISOString())
      .with_units(this.currentPumpSettings.units)
      .with_carbRatio(this.currentPumpSettings.carbRatio)
      .with_insulinSensitivity(this.currentPumpSettings.insulinSensitivity)
      .with_bgTarget(this.currentPumpSettings.bgTarget)
      .with_bolus({
        calculator: {
          enabled: this.currentPumpSettings.isBolusWizardEnabled,
          insulin: {
            duration: this.currentPumpSettings.durationOfInsulinAction,
            units: 'minutes',
          },
        },
        extended: {
          enabled: this.currentPumpSettings.isExtendedBolusEnabled,
        },
        amountMaximum: {
          value: this.currentPumpSettings.maxBolusAmount,
          units: 'Units',
        },
      })
      .with_basal({
        rateMaximum: {
          value: this.currentPumpSettings.maxBasalAmount,
          units: 'Units/hour',
        },
      })
      .with_display({
        bloodGlucose: {
          units: this.currentPumpSettings.displayBgUnits === NGPUtil.NGPConstants.BG_UNITS.MMOL_L ?
            'mmol/L' : 'mg/dL',
        },
      })
      .with_manufacturers(this.cfg.deviceManufacturers)
      .with_model(this.currentPumpSettings.pumpModel)
      .with_serialNumber(this.currentPumpSettings.pumpSerial)
      .with_basalSchedules(this.currentPumpSettings.basalSchedules)
      .with_activeSchedule(this.currentPumpSettings.activeSchedule);
    this.addTimeFields(currentSettings, currentNgpTimestamp);

    const settingsChange = _.cloneDeep(currentSettings);
    // Rebind the 'with_' handlers on the cloned object. Some of the
    // with_ changes were being made on the original, not the clone. :\
    // eslint-disable-next-line no-underscore-dangle
    settingsChange._bindProps();

    const oldEventTypes = [
      NGPHistoryEvent.EVENT_TYPE.OLD_BOLUS_WIZARD_BG_TARGETS,
      NGPHistoryEvent.EVENT_TYPE.OLD_BOLUS_WIZARD_INSULIN_SENSITIVITY,
      NGPHistoryEvent.EVENT_TYPE.OLD_BOLUS_WIZARD_INSULIN_TO_CARB_RATIOS,
      NGPHistoryEvent.EVENT_TYPE.OLD_BASAL_PATTERN,
    ];

    const newEventTypes = [
      NGPHistoryEvent.EVENT_TYPE.NEW_BOLUS_WIZARD_BG_TARGETS,
      NGPHistoryEvent.EVENT_TYPE.NEW_BOLUS_WIZARD_INSULIN_SENSITIVITY,
      NGPHistoryEvent.EVENT_TYPE.NEW_BOLUS_WIZARD_INSULIN_TO_CARB_RATIOS,
      NGPHistoryEvent.EVENT_TYPE.NEW_BASAL_PATTERN,
      NGPHistoryEvent.EVENT_TYPE.BASAL_PATTERN_SELECTED,
      NGPHistoryEvent.EVENT_TYPE.MAX_BASAL_RATE_CHANGE,
      NGPHistoryEvent.EVENT_TYPE.MAX_BOLUS_CHANGE,
      NGPHistoryEvent.EVENT_TYPE.DUAL_BOLUS_OPTION_CHANGE,
      NGPHistoryEvent.EVENT_TYPE.BOLUS_WIZARD_SETTINGS_CHANGE,
    ];

    for (const event of this.eventsOfTypeReverse(...oldEventTypes, ...newEventTypes)) {
      switch (event.eventType) {
        case NGPHistoryEvent.EVENT_TYPE.NEW_BOLUS_WIZARD_BG_TARGETS:
        case NGPHistoryEvent.EVENT_TYPE.OLD_BOLUS_WIZARD_BG_TARGETS:
          {
            const targets = event.bgTargets();
            // Because we read the initial pump settings in mg/dL, always convert settings changes.
            // When we confirm that we can determine pump BG units correctly in
            // DeviceCharacteristicsResponse:units(), we can remove the conversion here.
            if (event.units === NGPUtil.NGPConstants.BG_UNITS.MMOL_L) {
              for (const target of targets) {
                target.high = parseFloat((target.high * 18.01559).toFixed(2));
                target.low = parseFloat((target.low * 18.01559).toFixed(2));
              }
            }
            settingsChange.with_bgTarget(targets);
          }
          break;
        case NGPHistoryEvent.EVENT_TYPE.NEW_BOLUS_WIZARD_INSULIN_SENSITIVITY:
        case NGPHistoryEvent.EVENT_TYPE.OLD_BOLUS_WIZARD_INSULIN_SENSITIVITY:
          {
            const isfs = event.isfs();
            // Because we read the initial pump settings in mg/dL, always convert settings changes.
            // When we confirm that we can determine pump BG units correctly in
            // DeviceCharacteristicsResponse:units(), we can remove the conversion here.
            if (event.units === NGPUtil.NGPConstants.BG_UNITS.MMOL_L) {
              for (const isf of isfs) {
                isf.amount = parseFloat((isf.amount * 18.01559).toFixed(2));
              }
            }
            settingsChange.with_insulinSensitivity(isfs);
          }
          break;
        case NGPHistoryEvent.EVENT_TYPE.NEW_BOLUS_WIZARD_INSULIN_TO_CARB_RATIOS:
        case NGPHistoryEvent.EVENT_TYPE.OLD_BOLUS_WIZARD_INSULIN_TO_CARB_RATIOS:
          {
            const carbRatios = event.carbRatios();
            // Since pumpSettings doesn't support `exchanges` as a unit, convert all
            // exchanges to grams.
            if (event.units === NGPUtil.NGPConstants.CARB_UNITS.EXCHANGES) {
              settingsChange.units.carb = 'exchanges';
            } else {
              settingsChange.units.carb = 'grams';
            }

            settingsChange.with_carbRatio(carbRatios);
          }
          break;
        case NGPHistoryEvent.EVENT_TYPE.NEW_BASAL_PATTERN:
        case NGPHistoryEvent.EVENT_TYPE.OLD_BASAL_PATTERN:
          // Basal changes with empty schedules are deletions.
          if (event.patterns().length === 0 &&
            _.isObject(settingsChange.basalSchedules[event.patternName])) {
            delete settingsChange.basalSchedules[event.patternName];
          }
          settingsChange.basalSchedules[event.patternName] = event.patterns();
          break;
        case NGPHistoryEvent.EVENT_TYPE.BASAL_PATTERN_SELECTED:
          settingsChange
            .with_activeSchedule(event.newPatternName);
          break;
        case NGPHistoryEvent.EVENT_TYPE.MAX_BASAL_RATE_CHANGE:
          settingsChange.basal.rateMaximum = {
            value: event.newValue,
            units: 'Units/hour',
          };
          break;
        case NGPHistoryEvent.EVENT_TYPE.MAX_BOLUS_CHANGE:
          settingsChange.bolus.amountMaximum = {
            value: event.newValue,
            units: 'Units',
          };
          break;
        case NGPHistoryEvent.EVENT_TYPE.DUAL_BOLUS_OPTION_CHANGE:
          // eslint-disable-next-line no-unneeded-ternary
          settingsChange.bolus.extended.enabled = event.newOptionChange ? true : false;
          break;
        case NGPHistoryEvent.EVENT_TYPE.BOLUS_WIZARD_SETTINGS_CHANGE:
          settingsChange.bolus.calculator.insulin.duration = event.newDurationOfInsulinAction;
          settingsChange.bolus.calculator.enabled = event.newEnabled;
          break;
        default:
          debug('Unexpected settings change type', event.eventType);
          throw new Error('Unexpected settings change');
      }

      if (_.indexOf(newEventTypes, event.eventType) > -1) {
        // only push new changes onto the stack
        settingsChange.with_time(event.timestamp.toDate().toISOString());
        this.addTimeFields(settingsChange, event.timestamp);
        events.push(_.cloneDeep(settingsChange.done()));
      }

      // these event types contain old and new values in the same event,
      // so we set the old values after changes have been pushed onto stack
      switch (event.eventType) {
        case NGPHistoryEvent.EVENT_TYPE.BASAL_PATTERN_SELECTED:
          settingsChange.activeSchedule = event.oldPatternName;
          break;
        case NGPHistoryEvent.EVENT_TYPE.MAX_BASAL_RATE_CHANGE:
          settingsChange.basal.rateMaximum.value = event.oldValue;
          break;
        case NGPHistoryEvent.EVENT_TYPE.MAX_BOLUS_CHANGE:
          settingsChange.bolus.amountMaximum.value = event.oldValue;
          break;
        case NGPHistoryEvent.EVENT_TYPE.DUAL_BOLUS_OPTION_CHANGE:
          // eslint-disable-next-line no-unneeded-ternary
          settingsChange.bolus.extended.enabled = event.oldOptionChange ? true : false;
          break;
        case NGPHistoryEvent.EVENT_TYPE.BOLUS_WIZARD_SETTINGS_CHANGE:
          settingsChange.bolus.calculator.insulin.duration = event.oldDurationOfInsulinAction;
          settingsChange.bolus.calculator.enabled = event.oldEnabled;
          break;
        default:
          break;
      }
    }

    // Now that we're done using currentSettings for cloning, complete it and push to events.
    events.push(currentSettings.done());

    return this;
  }

  buildAlarmRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.LOW_RESERVOIR)) {
      const lowReservoir = this.cfg.builder.makeDeviceEventAlarm()
        .with_alarmType(event.unitsRemaining === 0.0 ? 'no_insulin' : 'low_insulin')
        .with_payload({
          amount: event.unitsRemaining,
          timeRemaining: event.millisecondsRemaining,
        });

      this.addTimeFields(lowReservoir, event.timestamp);
      events.push(lowReservoir);
    }

    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.LOW_BATTERY)) {
      const lowBattery = this.cfg.builder.makeDeviceEventAlarm()
        .with_alarmType(event.unitsRemaining === 0.0 ? 'no_insulin' : 'low_insulin')
        .with_payload({
          amount: event.unitsRemaining,
          timeRemaining: event.millisecondsRemaining,
        });

      this.addTimeFields(lowBattery, event.timestamp);
      events.push(lowBattery);
    }

    return this;
  }

  buildCGMRecords(events) {
    for (const event of
      this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.SENSOR_GLUCOSE_READINGS_EXTENDED)) {
      for (const reading of event.readings()) {
        let annotation = null;
        // eslint-disable-next-line prefer-destructuring
        let sg = reading.sg;

        if (reading.sg === 776) {
          sg = 401;
          annotation = {
            code: 'bg/out-of-range',
            value: 'high',
            threshold: 400,
          };
        } else if (reading.sg === 777) {
          sg = 39;
          annotation = {
            code: 'bg/out-of-range',
            value: 'low',
            threshold: 40,
          };
        }

        if (reading.sg < 769 || annotation) {
          const record = this.cfg.builder.makeCBG()
            .with_value(sg)
            .with_units('mg/dL')
            .with_payload({
              interstitialSignal: reading.isig,
            });
          this.addTimeFields(record, reading.timestamp);
          if (annotation) {
            annotate.annotateEvent(record, annotation);
          }
          events.push(record.done());
        }
      }
    }

    return this;
  }

  buildCalibrationRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.CALIBRATION_COMPLETE)) {
      // In the Tidepool data model, calibration event timestamps match against the SMBG timestamp.
      // The CALIBRATION_COMPLETE event tells us when the calibration was accepted.
      // We need to find the matching SMBG to correctly set the timestamp.
      const matchingSmbg = this.findSmbgForCalibration(event);
      if (matchingSmbg != null) {
        const calibrationRecord = this.cfg.builder.makeDeviceEventCalibration()
          .with_units('mg/dL')
          .with_subType('calibration')
          .with_value(event.bgValue);
        this.addTimeFields(calibrationRecord, matchingSmbg.timestamp);
        events.push(calibrationRecord.done());
      }
    }
  }

  buildBGRecords(events) {
    /* eslint-disable indent */
    for (const event of [...this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.BG_READING),
        ...this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.CLOSED_LOOP_BG_READING),
      ]) {
      /* eslint-enable indent */
      let reading = null;

      if (event instanceof ClosedLoopBloodGlucoseReadingEvent) {
        // If it's a ClosedLoopBloodGlucoseReadingEvent that has been RECEIVED_FROM_RF,
        // we only create an SMBG based on the BG_READING_RECEIVED event, putting all
        // of the matching historic events into the annotations and payload.
        // If its MANUALLY_ENTERED, match the annotations off any of the ENTERED_* contexts
        if (event.isFirstReading()) {
          reading = this.cfg.builder.makeSMBG()
            .with_units('mg/dL')
            .with_subType(event.bgLinked ? 'linked' : 'manual')
            .with_value(event.bgValue);

          // Add annotations for the different contexts
          const bgContexts = {};
          for (const matchedBgReading of [...this.findMatchingClosedLoopBGReadings(event), event]) {
            const annotationText = _.chain(NGPUtil.NGPConstants.BG_CONTEXT)
              .findKey(o => o === matchedBgReading.bgReadingContext).lowerCase()
              .replace(/ /g, '-')
              .value();
            // Don't annotate Guardian Transmitter (GST) Signal Integrity (SI) contexts
            if (matchedBgReading.bgReadingContext !==
                NGPUtil.NGPConstants.BG_CONTEXT.BG_SI_PASS_RESULT_RECD_FRM_GST &&
                matchedBgReading.bgReadingContext !==
                NGPUtil.NGPConstants.BG_CONTEXT.BG_SI_FAIL_RESULT_RECD_FRM_GST) {
              annotate.annotateEvent(reading, `medtronic600/smbg/${annotationText}`);
            }
            bgContexts[annotationText] = matchedBgReading.timestamp.toDate();
          }
          reading.with_payload({
            bgContexts,
          });
        }
      } else {
        reading = this.cfg.builder.makeSMBG()
          .with_units('mg/dL')
          .with_subType(event.bgLinked ? 'linked' : 'manual')
          .with_value(event.bgValue);
      }

      if (reading !== null) {
        if (event.bgLinked && event.eventType === NGPHistoryEvent.EVENT_TYPE.BG_READING) {
          reading.with_payload({
            meterSerial: event.meterSerialNumber,
          });
        }

        this.addTimeFields(reading, event.timestamp);
        events.push(reading.done());
      }
    }

    return this;
  }

  buildBasalRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.BASAL_SEGMENT_START)) {
      if (this.firstBasalTime && (this.firstBasalTime.toDate() > event.timestamp.toDate())) {
        debug(`Dropping basal event at ${sundial.formatDeviceTime(event.timestamp.toDate())} that occurred prior to temp basal with missing start time`);
      } else {
        const basal = this.cfg.builder.makeScheduledBasal()
          .with_rate(event.rate)
          .with_scheduleName(event.patternName);

        this.addTimeFields(basal, event.timestamp);

        events.push(basal);
      }
    }

    // Add gaps from beginning of Auto Mode start until first microbolus, or basal event
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.CLOSED_LOOP_TRANSITION)) {
      if (event.transitionValue ===
        NGPUtil.NGPConstants.CL_TRANSITION_VALUE.CL_INTO_ACTIVE) {
        const gap = this.getAutoModeStartGap(event);
        const basal = this.cfg.builder.makeAutomatedBasal()
          .with_rate(0.0)
          .with_duration(gap)
          .with_scheduleName('Auto-Basal');

        this.addTimeFields(basal, event.timestamp);

        events.push(basal);
      }
    }

    // Add Closed Loop micro boluses
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.NORMAL_BOLUS_DELIVERED)) {
      if (event.bolusSource === NGPUtil.NGPConstants.BOLUS_SOURCE.CLOSED_LOOP_MICRO_BOLUS) {
        const basal = this.cfg.builder.makeAutomatedBasal()
          // We assume that the microbolus delivery covers a 5 minute period.
          // Multiply by 12 to make it an hourly value.
          // The minimum a 600-series pump can deliver is 0.025U, so precision
          // is 3 decimal places.
          .with_rate(parseFloat((event.deliveredAmount * 12).toFixed(3)))
          .with_scheduleName('Auto-Basal')
          .with_payload({
            microbolusAmount: event.deliveredAmount,
          });

        this.addTimeFields(basal, event.timestamp);

        events.push(basal);
      }
    }

    return this;
  }

  buildTempBasalRecords(events) {
    // Build temp basal records from the TEMP_BASAL_COMPLETE, since that event type contains
    // more detail, such as actual duration, and if the event was delivered as scheduled, or
    // cancelled.
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.TEMP_BASAL_COMPLETE)) {
      // Since we're using the TEMP_BASAL_COMPLETE event, we need to get the Device timestamp
      // for the *beginning* of the event.
      const startTempBasal = this.findTempBasalStartForComplete(event);
      const suppressedBasal = this.findSuppressedBasal(startTempBasal);

      // If we're missing the start event information for this complete event,
      // or we're missing the underlying suppressed basal, we ignore the temp
      // basal altogether.
      if (startTempBasal != null && suppressedBasal != null) {
        const basal = this.cfg.builder.makeTempBasal()
          .with_rate(event.rate)
          .with_duration(event.duration)
          .with_expectedDuration(startTempBasal.expectedDuration)
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: suppressedBasal.rate,
            scheduleName: suppressedBasal.patternName,
          });

        if (event.canceled) {
          // When a temp basal is cancelled, we have to calculate the duration.
          // Since we don't know if a time change occurred during the temp basal,
          // we can't use the rtc + offsets to calculate the duration, but have
          // to use just the rtc instead
          basal.with_duration((event.timestamp.rtc -
            startTempBasal.timestamp.rtc) * sundial.SEC_TO_MSEC);
        }

        // We need to find the normal rate here to calculate event.rate, because
        // if it's a PERCENT record, event.rate will be 0.
        if (event.type === NGPUtil.NGPConstants.TEMP_BASAL_TYPE.PERCENTAGE) {
          basal
            .with_percent(event.percentageOfRate / 100.0)
            .with_rate(suppressedBasal.rate * (event.percentageOfRate / 100.0));
        }

        this.addTimeFields(basal, startTempBasal.timestamp);

        events.push(basal);
      }
    }

    // Check if the last temp basal event is a start event. If we have a TEMP_BASAL_PROGRAMMED
    // without a TEMP_BASAL_COMPLETE, we should synthesize the temp basal event with what we
    // know, and it will be overwritten in the next upload that contains the corresponding
    // TEMP_BASAL_COMPLETE event.
    const lastTempBasalEvent =
      this.eventsOfTypeReverse(
        NGPHistoryEvent.EVENT_TYPE.TEMP_BASAL_PROGRAMMED,
        NGPHistoryEvent.EVENT_TYPE.TEMP_BASAL_COMPLETE,
      ).next().value;
    if (lastTempBasalEvent &&
      lastTempBasalEvent.eventType === NGPHistoryEvent.EVENT_TYPE.TEMP_BASAL_PROGRAMMED) {
      const suppressedBasal = this.findSuppressedBasal(lastTempBasalEvent);
      // Don't create the temp basal if we don't find the underlying suppressed info
      // This could happen if the ONLY basal event we retrieve from the pump history
      // is a TEMP_BASAL_PROGRAMMED.
      if (suppressedBasal != null) {
        const basal = this.cfg.builder.makeTempBasal()
          .with_rate(lastTempBasalEvent.rate)
          .with_expectedDuration(lastTempBasalEvent.expectedDuration)
          .with_duration(lastTempBasalEvent.expectedDuration)
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: suppressedBasal.rate,
            scheduleName: suppressedBasal.patternName,
          });

        // We need to find the normal rate here to calculate event.rate, because
        // if it's a PERCENT record, event.rate will be 0.
        if (lastTempBasalEvent.type === NGPUtil.NGPConstants.TEMP_BASAL_TYPE.PERCENTAGE) {
          basal
            .with_percent(lastTempBasalEvent.percentageOfRate / 100.0)
            .with_rate(suppressedBasal.rate * (lastTempBasalEvent.percentageOfRate / 100.0));
        }

        this.addTimeFields(basal, lastTempBasalEvent.timestamp);
        annotate.annotateEvent(basal, 'basal/unknown-duration');

        events.push(basal);
      }
    }

    return this;
  }

  buildSuspendResumeRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.INSULIN_DELIVERY_STOPPED)) {
      const resumeEvent = this.findResumeForSuspend(event);

      const reason = {
        suspended: 'automatic',
        resumed: 'automatic',
      };

      if (event.suspendReason === NGPUtil.NGPConstants.SUSPEND_REASON.USER_SUSPEND ||
        event.suspendReason === NGPUtil.NGPConstants.SUSPEND_REASON.SET_CHANGE_SUSPEND) {
        reason.suspended = 'manual';
      }

      if (resumeEvent != null &&
        (resumeEvent.resumeReason === NGPUtil.NGPConstants.RESUME_REASON.USER_SELECTS_RESUME ||
          resumeEvent.resumeReason === NGPUtil.NGPConstants.RESUME_REASON.USER_CLEARS_ALARM)) {
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

      const duration = resumeEvent == null ? 0 :
        (resumeEvent.timestamp.rtc - event.timestamp.rtc) * 1000;
      if (duration < 0) {
        throw new Error('Suspend event duration cannot be less than zero');
      }

      const suspendResumeEvent = this.cfg.builder.makeDeviceEventSuspendResume()
        .with_reason(reason)
        .with_duration(duration)
        .with_payload(payload);

      if (resumeEvent == null) {
        annotate.annotateEvent(suspendResumeEvent, 'status/incomplete-tuple');
      }

      this.addTimeFields(suspendResumeEvent, event.timestamp);

      events.push(suspendResumeEvent.done());

      const suspendedBasal = this.cfg.builder.makeSuspendBasal()
        .with_duration(duration);
      this.addTimeFields(suspendedBasal, event.timestamp);

      events.push(suspendedBasal);
    }

    return this;
  }

  buildNormalBolusRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.NORMAL_BOLUS_DELIVERED)) {
      if (event.bolusSource === NGPUtil.NGPConstants.BOLUS_SOURCE.CLOSED_LOOP_MICRO_BOLUS) {
        // We process Closed loop micro boluses as basals in buildBasalRecords.
        // They are not normal basals.
        // eslint-disable-next-line no-continue
        continue;
      }

      // We need the timestamp of the time the Bolus event was programmed, not
      // when it finished. Even for a normal basal, delivery for 100g of carbs can
      // take a few minutes.
      const beginTimestamp = this.getBeginTimestampForBolusDelivered(event);
      // If we didn't find a matching start event, don't upload the bolus. Either we've already
      // uploaded it in the past, or we just don't have enough data to upload it.
      if (beginTimestamp != null) {
        const bolus = this.cfg.builder.makeNormalBolus()
          .with_normal(event.deliveredAmount);

        if (event.programmedAmount !== event.deliveredAmount) {
          bolus.with_expectedNormal(event.programmedAmount);
        }

        this.addTimeFields(bolus, beginTimestamp);

        if (event.isWizardBolus()) {
          const wizardEvent = this.findWizardForBolus(event, event.programmedAmount);
          events.push(this.chooseWizardOrBolusRecord(wizardEvent, bolus.done()));
        } else {
          events.push(bolus.done());
        }
      }
    }
    return this;
  }

  buildSquareBolusRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.SQUARE_BOLUS_DELIVERED)) {
      // We need to get the Device timestamp for the *beginning* of the event.
      const beginTimestamp = this.getBeginTimestampForBolusDelivered(event);
      // If we didn't find a matching start event, don't upload the bolus. Either we've already
      // uploaded it in the past, or we just don't have enough data to upload it.
      if (beginTimestamp != null) {
        const bolus = this.cfg.builder.makeSquareBolus()
          .with_duration(event.deliveredDuration * sundial.SEC_TO_MSEC)
          .with_extended(event.deliveredAmount);

        if (event.programmedAmount !== event.deliveredAmount ||
          event.programmedDuration !== event.deliveredDuration) {
          bolus.with_expectedExtended(event.programmedAmount)
            .with_expectedDuration(event.programmedDuration * sundial.SEC_TO_MSEC);
        }

        this.addTimeFields(bolus, beginTimestamp);

        if (event.isWizardBolus()) {
          const wizardEvent = this.findWizardForBolus(event, event.programmedAmount);
          events.push(this.chooseWizardOrBolusRecord(wizardEvent, bolus.done()));
        } else {
          events.push(bolus.done());
        }
      }
    }
    return this;
  }

  buildDualBolusRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.DUAL_BOLUS_PART_DELIVERED)) {
      // We need to get the Device timestamp for the *beginning* of the event.
      const beginTimestamp = this.getBeginTimestampForBolusDelivered(event);
      // If we didn't find a matching start event, don't upload the bolus. Either we've already
      // uploaded it in the past, or we just don't have enough data to upload it.
      if (beginTimestamp != null) {
        // There are 2 events for a dual bolus delivery - we only react to the first part,
        // and in processing that, find the second part to build the TP data.
        if (event.bolusPart === NGPUtil.NGPConstants.DUAL_BOLUS_PART.NORMAL_BOLUS) {
          const matchingBolus = this.findMatchingDualBolusEvent(event);
          // Only upload an extended bolus once it is complete. We don't upload an
          // in-progress bolus.
          if (matchingBolus != null) {
            const bolus = this.cfg.builder.makeDualBolus()
              .with_normal(event.deliveredAmount)
              .with_extended(matchingBolus.deliveredAmount)
              .with_duration(matchingBolus.deliveredDuration * sundial.SEC_TO_MSEC);

            if (event.normalProgrammedAmount !== event.deliveredAmount) {
              bolus
                .with_expectedNormal(event.normalProgrammedAmount);
            }

            if (matchingBolus.squareProgrammedAmount !== matchingBolus.deliveredAmount ||
              matchingBolus.programmedDuration !== matchingBolus.deliveredDuration) {
              bolus
                .with_expectedExtended(matchingBolus.squareProgrammedAmount)
                .with_expectedDuration(matchingBolus.programmedDuration * sundial.SEC_TO_MSEC);
            }

            this.addTimeFields(bolus, beginTimestamp);

            if (event.isWizardBolus()) {
              // Use parseFloat(num.toFixed(3)), because in JavaScript,
              // 5.20 + 5.15 = 10.350000000000001
              // The minimum a 600-series pump can deliver is 0.025U, so precision
              // is 3 decimal places.
              const wizardEvent = this.findWizardForBolus(
                event,
                parseFloat((event.normalProgrammedAmount + event.squareProgrammedAmount)
                  .toFixed(3)),
              );
              events.push(this.chooseWizardOrBolusRecord(wizardEvent, bolus.done()));
            } else {
              events.push(bolus.done());
            }
          }
        }
      }
    }
    return this;
  }

  buildWizardWithoutBolusRecords(events) {
    for (const event of this.eventsOfType(
      NGPHistoryEvent.EVENT_TYPE.BOLUS_WIZARD_ESTIMATE,
      NGPHistoryEvent.EVENT_TYPE.MEAL_WIZARD_ESTIMATE,
    )) {
      if (event.finalEstimate === 0) {
        // there is no bolus record, so we create a zero bolus
        let zeroBolus = this.cfg.builder.makeNormalBolus()
          .with_normal(0)
          .with_expectedNormal(0);
        this.addTimeFields(zeroBolus, event.timestamp);
        zeroBolus = zeroBolus.done();

        events.push(this.buildWizardRecord(event, zeroBolus));
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
        correction: wizardEvent.correctionEstimate,
        net: wizardEvent.wizardEstimate,
      })
      .with_bolus(wizardBolus)
      .with_carbInput(wizardEvent.carbInput)
      .with_insulinOnBoard(wizardEvent.iob)
      .with_insulinCarbRatio(wizardEvent.carbRatio)
      .with_insulinSensitivity(wizardEvent.isf)
      .with_units(wizardEvent.bgUnits === NGPUtil.NGPConstants.BG_UNITS.MG_DL ? 'mg/dL' : 'mmol/L')
      .with_carbUnits(wizardEvent.carbUnits === NGPUtil.NGPConstants.CARB_UNITS.GRAMS ? 'grams' : 'exchanges');

    if (wizardEvent.eventType === NGPHistoryEvent.EVENT_TYPE.MEAL_WIZARD_ESTIMATE) {
      annotate.annotateEvent(wizard, 'wizard/target-automated');
    } else {
      wizard.with_bgTarget({
        low: wizardEvent.lowBgTarget,
        high: wizardEvent.highBgTarget,
      });
    }

    if (wizardEvent.bgInput > 0) {
      wizard.with_bgInput(wizardEvent.bgInput);
    }

    this.addTimeFields(wizard, wizardEvent.timestamp);

    return wizard.done();
  }

  chooseWizardOrBolusRecord(wizardEvent, bolusEvent) {
    if (wizardEvent != null) {
      return this.buildWizardRecord(wizardEvent, bolusEvent);
    }
    return bolusEvent;
  }

  buildRewindRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.REWIND)) {
      const rewind = this.cfg.builder.makeDeviceEventReservoirChange();

      this.addTimeFields(rewind, event.timestamp);

      events.push(rewind.done());
    }

    return this;
  }

  buildPrimeRecords(events) {
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.CANNULA_FILL_DELIVERED)) {
      // If the user skips a prime in the pump UI, the pump history still contains the fill
      // event, but with an amount of zero. We skip those.
      if (event.amount !== 0) {
        const prime = this.cfg.builder.makeDeviceEventPrime()
          .with_primeTarget(event.type === NGPUtil.NGPConstants.CANNULA_FILL_TYPE.TUBING_FILL ? 'tubing' : 'cannula')
          .with_volume(event.amount);

        this.addTimeFields(prime, event.timestamp);

        events.push(prime.done());
      } else {
        debug('Skipping zero-fill prime event');
      }
    }

    return this;
  }
}

module.exports = NGPHistoryParser;
