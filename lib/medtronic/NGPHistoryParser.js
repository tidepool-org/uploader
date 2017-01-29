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
      SENSOR_GLUCOSE_READING: 0xD6,
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
      case NGPHistoryEvent.EVENT_TYPE.SENSOR_GLUCOSE_READING:
        return new SensorGlucoseReadingsEvent(this.eventData);
      default:
        debug('Unknown Instance type:', this.eventType);
        // Return a default NGPHistoryEvent
        return this;
    }
    /* eslint-enable no-use-before-define */
  }

  get timestamp() {
    return NGPUtil.NGPTimestamp.fromBuffer(this.eventData.slice(0x03, 0x0B));
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

class NGPHistoryParser {
  constructor(cfg, pages) {
    this.cfg = cfg;
    this.pages = pages;
    // this.events is an object keyed by the event type.
    this.events = {};
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
    for (let i = 0; i < this.events[eventType].length; i++) {
      yield this.events[eventType][i];
    }
  }

  processData() {
    // Because we are converting data from this.pages to this.events, we consume the pages as we
    // process them to save on memory.
    while (this.pages.length > 0) {
      const page = this.pages.shift();
      for (const event of NGPHistoryParser.eventsFromPageString(page)) {
        if (this.events[event.eventType] === undefined) {
          this.events[event.eventType] = [];
        }
        this.events[event.eventType].push(event.eventInstance());
      }
    }

    debug('*** Processed event types:', Object.keys(this.events));
  }

  buildCGMRecords() {
    const postRecords = [];
    debug('*** CGM events:', this.events[NGPHistoryEvent.EVENT_TYPE.SENSOR_GLUCOSE_READING].length);
    for (const event of this.eventsOfType(NGPHistoryEvent.EVENT_TYPE.SENSOR_GLUCOSE_READING)) {
      debug('*** EVENT', event.timestamp.toDate('Etc/UTC'), event.numberOfReadings);
      for (const reading of event.readings()) {
        debug('*** READING', reading);

        if (reading.sg < 769) { // ignore magic numbers
          let record = this.cfg.builder.makeCBG()
            .with_value(reading.sg)
            .with_deviceTime(sundial.formatDeviceTime(reading.timestamp))
            .with_units('mg/dL')
            .with_payload({
              interstitialSignal: reading.isig,
            });
            // .set('index', index + offset);
          this.cfg.tzoUtil.fillInUTCInfo(record, reading.timestamp);
          record = record.done();
          postRecords.push(record);
        }
      }
    }

    return postRecords;
  }
}

module.exports = NGPHistoryParser;
