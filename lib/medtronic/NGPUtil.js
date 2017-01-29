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

/* global chrome */

const sundial = require('sundial');

// NGP = Next Generation Pump. It's the acronym that Medtronic use in their code for the 600-series.
class NGPTimestamp {
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
      new Date(NGPTimestamp.pumpBaseTimeMS + (this.rtc * 1000) + (this.offset * 1000)),
      timezone);
  }

  rtcFromDate(userDate) {
    return ((userDate.getTime() - NGPTimestamp.pumpBaseTimeMS) / 1000) - this.offset;
  }

  static fromBuffer(buffer) {
    const rtc = buffer.readUInt32BE(0x00);
    const offset = buffer.readUInt32BE(0x04) - 0x100000000;
    return new NGPTimestamp(rtc, offset);
  }
}

module.exports.NGPTimestamp = NGPTimestamp;
