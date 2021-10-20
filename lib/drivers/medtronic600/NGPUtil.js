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

import _ from 'lodash';
import sundial from 'sundial';
import crypto from 'crypto';

// NGP = Next Generation Pump. It's the acronym that Medtronic use in their code for the 600-series.
export class NGPTimestamp {
  static get pumpBaseTimeMS() {
    // Midnight 1st January 2000 in your LOCAL timezone, even though it looks like an epoch value.
    return 946684800000;
  }

  static get maxRTC() {
    return 0xFFFFFFFF;
  }

  constructor(rtc, offset) {
    this.rtc = rtc;
    this.offset = offset;
  }

  toDate(timezone) {
    return sundial.applyTimezone(
      new Date(NGPTimestamp.pumpBaseTimeMS + (this.rtc * sundial.SEC_TO_MSEC) +
      (this.offset * sundial.SEC_TO_MSEC)),
      timezone,
    );
  }

  rtcFromDate(userDate) {
    return ((userDate.getTime() - NGPTimestamp.pumpBaseTimeMS) / 1000) - this.offset;
  }

  static fromBuffer(buffer) {
    const rtc = buffer.readUInt32BE(0x00);
    const offset = buffer.readUInt32BE(0x04) - 0x100000000;
    return new NGPTimestamp(rtc, offset);
  }

  static fromDateAndRtc(jsDate, rtc) {
    const offset = (jsDate.getTime() - NGPTimestamp.pumpBaseTimeMS - (rtc * 1000)) / 1000;
    return new NGPTimestamp(rtc, offset);
  }
}

export class NGPConstants {
  // Pump state is returned as a 1-byte bitfield.
  static get PUMP_STATE_FLAGS() {
    return {
      SUSPENDED: 1,
      BOLUSING: 2,
      ACTIVE: 16, // INACTIVE means pump rewound, needs reservoir
      TEMP_BASAL_ACTIVE: 32,
      CGM_ACTIVE: 64,
    };
  }

  static get BG_UNITS() {
    return {
      MG_DL: 0,
      MMOL_L: 1,
    };
  }

  static get CARB_UNITS() {
    return {
      GRAMS: 0,
      EXCHANGES: 1,
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

  static get BG_ORIGIN() {
    return {
      MANUALLY_ENTERED: 0,
      RECEIVED_FROM_RF: 1,
    };
  }

  static get BG_CONTEXT() {
    return {
      BG_READING_RECEIVED: 0,
      USER_ACCEPTED_REMOTE_BG: 1,
      USER_REJECTED_REMOTE_BG: 2,
      REMOTE_BG_ACCEPTANCE_SCREEN_TIMEOUT: 3,
      BG_SI_PASS_RESULT_RECD_FRM_GST: 4, // Signal Integrity pass from Guardian Transmitter
      BG_SI_FAIL_RESULT_RECD_FRM_GST: 5, // Signal Integrity fail from Guardian Transmitter
      BG_SENT_FOR_CALIB: 6,
      USER_REJECTED_SENSOR_CALIB: 7,
      ENTERED_IN_BG_ENTRY: 8,
      ENTERED_IN_MEAL_WIZARD: 9,
      ENTERED_IN_BOLUS_WIZARD: 10,
      ENTERED_IN_SENSOR_CALIB: 11,
      ENTERED_AS_BG_MARKER: 12,
    };
  }

  static get BASAL_PATTERN_NAME() {
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

  static get CL_TRANSITION_REASON() {
    return {
      INTO_ACTIVE_DUE_TO_GLUCOSE_SENSOR_CALIBRATION: 0,
      OUT_OF_ACTIVE_DUE_TO_USER_OVERRIDE: 1,
      OUT_OF_ACTIVE_DUE_TO_ALARM: 2,
      OUT_OF_ACTIVE_DUE_TO_TIMEOUT_FROM_SAFE_BASAL: 3,
      OUT_OF_ACTIVE_DUE_TO_PROLONGED_HIGH_SG: 4,
    };
  }

  static get CL_TRANSITION_VALUE() {
    return {
      CL_OUT_OF_ACTIVE: 0,
      CL_INTO_ACTIVE: 1,
    };
  }

  static get TEMP_BASAL_TYPE() {
    return {
      INSULIN_UNITS: 0,
      PERCENTAGE: 1,
    };
  }

  static get TEMP_BASAL_PRESET_NAME() {
    return [
      'Manual',
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

  static get BOLUS_SOURCE() {
    return {
      MANUAL: 0,
      BOLUS_WIZARD: 1,
      EASY_BOLUS: 2,
      PRESET_BOLUS: 4,
      CLOSED_LOOP_MICRO_BOLUS: 5,
      CLOSED_LOOP_BG_CORRECTION: 6,
      CLOSED_LOOP_FOOD_BOLUS: 7,
      CLOSED_LOOP_BG_CORRECTION_AND_FOOD_BOLUS: 8,
    };
  }

  static get BOLUS_PRESET_NAME() {
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

  static get BOLUS_STEP_SIZE() {
    return {
      STEP_0_POINT_025: 0,
      STEP_0_POINT_05: 1,
      STEP_0_POINT_1: 2,
    };
  }

  static get CANNULA_FILL_TYPE() {
    return {
      TUBING_FILL: 0,
      CANULLA_FILL: 1,
    };
  }

  static get DUAL_BOLUS_PART() {
    return {
      NORMAL_BOLUS: 1,
      SQUARE_WAVE: 2,
    };
  }

  static get SUSPEND_REASON() {
    return {
      ALARM_SUSPEND: 1, // Battery change, cleared occlusion, etc
      USER_SUSPEND: 2,
      AUTO_SUSPEND: 3,
      LOWSG_SUSPEND: 4,
      SET_CHANGE_SUSPEND: 5, // AKA NOTSEATED_SUSPEND
      PLGM_PREDICTED_LOW_SG: 10,
    };
  }

  static get SUSPEND_REASON_NAME() {
    return {
      1: 'Alarm suspend',
      2: 'User suspend',
      3: 'Auto suspend',
      4: 'Low glucose suspend',
      5: 'Set change suspend',
      10: 'Predicted low glucose suspend',
    };
  }

  static get RESUME_REASON() {
    return {
      USER_SELECTS_RESUME: 1,
      USER_CLEARS_ALARM: 2,
      LGM_MANUAL_RESUME: 3,
      LGM_AUTO_RESUME_MAX_SUSP: 4, // After an auto suspend, but no CGM data afterwards.
      LGM_AUTO_RESUME_PSG_SG: 5, // When SG reaches the Preset SG level
      LGM_MANUAL_RESUME_VIA_DISABLE: 6,
    };
  }

  static get RESUME_REASON_NAME() {
    return {
      1: 'User resumed',
      2: 'User cleared alarm',
      3: 'Low glucose manual resume',
      4: 'Low glucose auto resume - max suspend period',
      5: 'Low glucose auto resume - preset glucose reached',
      6: 'Low glucose manual resume via disable',
    };
  }

  static get RESERVOIR_WARNING_TYPE() {
    return {
      INSULIN: 0,
      TIME: 1,
    };
  }
}

export class NGPLinkCipher {
  static randomBuffer(length) {
    return Buffer.from(Array.from({
      length,
    }, () => Math.floor(Math.random() * 0xFF)));
  }

  static packLinkKey(plaintext, key, cipherLength) {
    if (cipherLength < 55) {
      throw new TypeError('Requested cipher length must be 55 bytes or larger');
    }

    const ciphertext = NGPLinkCipher.randomBuffer(cipherLength);

    /* eslint-disable no-bitwise, no-plusplus, no-restricted-syntax */
    let pos = key.slice(-1) & 7;
    for (const i of plaintext) {
      const randomInt = Math.floor(Math.random() * 0xFF);

      ciphertext[pos++] = ((randomInt & 1) !== 1) ? i : ~i;

      ciphertext[pos++] = randomInt;
      if (((randomInt >> 1) & 1) === 0) {
        ciphertext[pos++] = Math.floor(Math.random() * 0xFF);
      }
    }
    /* eslint-enable no-bitwise, no-plusplus, no-restricted-syntax */

    return ciphertext;
  }

  static unpackLinkKey(ciphertext, key) {
    const plaintext = Buffer.alloc(16);

    /* eslint-disable no-bitwise, no-restricted-syntax */
    let pos = key.slice(-1) & 7;

    for (const i of _.range(plaintext.length)) {
      if ((ciphertext[pos + 1] & 1) === 1) {
        plaintext[i] = ~ciphertext[pos];
      } else {
        plaintext[i] = ciphertext[pos];
      }

      if (((ciphertext[pos + 1] >> 1) & 1) === 0) {
        pos += 3;
      } else {
        pos += 2;
      }
    }
    /* eslint-enable no-bitwise, no-restricted-syntax */

    return plaintext;
  }

  static encrypt(key, iv, clear) {
    const cipher = crypto.createCipheriv('aes-128-cfb', key, iv);
    let encrypted = cipher.update(clear, 'binary', 'hex');
    encrypted += cipher.final('hex');
    return Buffer.from(encrypted, 'hex');
  }

  static decrypt(key, iv, encrypted) {
    const decipher = crypto.createDecipheriv('aes-128-cfb', key, iv);
    let clear = decipher.update(encrypted, 'binary', 'hex');
    clear += decipher.final('hex');
    return Buffer.from(clear, 'hex');
  }
}

export function make32BitIntFromNBitSignedInt(signedValue, nBits) {
  /* eslint-disable no-bitwise */
  const sign = ((0xFFFFFFFF << nBits) & 0xFFFFFFFF) * ((signedValue >> nBits - 1) & 1);
  return (sign | signedValue) & 0xFFFFFFFF;
  /* eslint-enable no-bitwise */
}
