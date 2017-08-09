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

const isBrowser = typeof window !== 'undefined';
const debug = isBrowser ? require('bows')('FreeStyleLibreDriver') : console.log;

import structJs from '../../struct.js';
const struct = structJs();

import _ from 'lodash';
import sundial from 'sundial';

import TZOUtil from '../../TimezoneOffsetUtil';

import {OP_CODE, ERROR_DESCRIPTION, DB_RECORD_TYPE, CFG_TABLE_ID} from './freeStyleLibreConstants';

const FORMAT = {
  ERROR: 'bb',
  DATE_TIME: 'bbbbbsb',
  RECORD_HEADER: 'sbbin',
  HISTORICAL_DATA: 'ssss',
  TIME_CHANGE: 'iiss'
};

const FORMAT_LENGTH = _.mapValues(FORMAT, format => { return struct.structlen(format); });

const OP_CODE_PROCESSING_ORDER = [
  //OP_CODE.GET_CFG_SCHEMA, // not used for now
  //OP_CODE.GET_DB_SCHEMA, // not used for now
  OP_CODE.GET_DATE_TIME,
  OP_CODE.GET_CFG_DATA,
  OP_CODE.GET_DATABASE
];

export class FreeStyleLibreData {

  constructor(cfg) {
    this.cfg = cfg;

    this.opCodeHandlers = {};
    this.opCodeHandlers[OP_CODE.GET_DATE_TIME] = this.handleDateTime.bind(this);
    this.opCodeHandlers[OP_CODE.GET_DB_SCHEMA] = this.handleDatabaseSchema.bind(this);
    this.opCodeHandlers[OP_CODE.GET_DATABASE] = this.handleDatabase.bind(this);
    this.opCodeHandlers[OP_CODE.GET_CFG_SCHEMA] = this.handleConfigSchema.bind(this);
    this.opCodeHandlers[OP_CODE.GET_CFG_DATA] = this.handleConfigData.bind(this);
    this.opCodeHandlers[OP_CODE.ERROR] = this.constructor.handleError;

    this.factoryConfig = {};
    this.deviceDateTime = null;
    this.records = [];
    this.postRecords = [];
  }

  processAapPackets(aapPackets) {

    // sort AAP packets by their OP code
    const aapPacketsByOpCode = {};
    for (let aapPacket of aapPackets) {
      const opCode = aapPacket['opCode'];
      if (!(opCode in aapPacketsByOpCode)) {
        aapPacketsByOpCode[opCode] = [];
      }
      aapPacketsByOpCode[opCode].push(aapPacket);
    }

    // process AAP packet in fixed order to make sure data is available when needed
    for (let opCode of OP_CODE_PROCESSING_ORDER) {
      for (let aapPacket of aapPacketsByOpCode[opCode]) {
        const handler = this.opCodeHandlers[aapPacket['opCode']];
        if (handler) {
          handler(aapPacket);
        } else {
          debug('processAapPackets: no handler found for OP code:', aapPacket['opCode']);
        }
      }
    }

    this.records.sort((a, b) => b.headerFields.recordNumber - a.headerFields.recordNumber);

    var timestamp = this.records[this.records.length-1].dateTime;
console.log("RECORD:", this.records);
debugger;
    var mostRecent = sundial.applyTimezone(timestamp, this.cfg.timezone).toISOString();

    this.buildTimeChangeRecords();
    this.cfg.tzoUtil = new TZOUtil(this.cfg.timezone, mostRecent, this.postRecords);
debugger;
    this.buildCBGRecords();

    return this.postRecords;
  }

  static handleError(aapPacket) {
    const fields = struct.unpack(aapPacket.data, 0, FORMAT.ERROR, ['opCode', 'errorCode']);
    debug('handleError:', ERROR_DESCRIPTION[fields.errorCode], 'for OP code', fields.opCode);
    if (aapPacket.data.length > FORMAT_LENGTH.ERROR) {
      debug('handleError: extra data:', aapPacket.data.slice(FORMAT_LENGTH.ERROR).toString('hex'));
    }
  }

  handleDateTime(aapPacket) {
    if (aapPacket.dataLength !== FORMAT_LENGTH.DATE_TIME) {
      debug('handleDateTime: wrong data length:', aapPacket.dataLength, 'instead of', FORMAT_LENGTH.DATE_TIME);
      return;
    }
    const fields = struct.unpack(aapPacket.data, 0, FORMAT.DATE_TIME,
      ['second', 'minute', 'hour', 'day', 'month', 'year', 'valid']);
    if (fields.valid !== 1) {
      debug('handleDateTime: date not marked as valid:', fields.valid, aapPacket.data.data[0]);
      return;
    }
    this.deviceDateTime = new Date(fields.year, fields.month - 1, fields.day,
      fields.hour, fields.minute, fields.second);
    debug('handleDateTime: datetime:', this.deviceDateTime);
  }

  handleDatabaseSchema(aapPacket) {
    /*
     * These are ignored for now, as the schemata are already known from the specs.
     * For now they are hardcoded based on the specs for the few record types that are actually needed.
     *
     * The schemata describe the fields in the database records, so that using this information to parse the records
     * instead of the hardcoded format strings, would make it possible to understand the data even after a potential
     * firmware upgrade that changes the database structure.
     * (As long as the field IDs stay the same, the fields parsed via these schemata can still be evaluated properly.)
     *
     * Schema description: (example: the record header prefixed to all records)
     *
        UINT8 RecordHeader_schema[] =
        {
          // schema descriptor
          48, 0, // [uint16_le] schema table length (including this descriptor)
          1, 0,  // [uint16_le] schema table version
          255,   // [uint8]     schema table/record ID
          6, 0,  // [uint16_le] number of data words (16bit) in the record
          5,     // [uint8]     number of fields in the record

          // field descriptors (8 byte each)
          // [uint16_le],  [uint16_le],  [uint8],                     [uint8],    [uint16_le]
          // field ID,     word offset,  bit offset inside the word,  data type,  data length in bits
          0,0,0,0,0,1,16,0,
          8,0,1,0,0,0,8,0,
          7,0,1,0,15,0,1,0,
          9,0,2,0,0,0,32,0,
          10,0,4,0,0,2,32,0
        };
     *
     */
  }

  getDateTime(readerTime, userTimeOffset) {
    const unixTimestamp = this.factoryConfig.timeConversion + readerTime + userTimeOffset;
    return new Date(unixTimestamp * 1000);
  }

  buildTimeChangeRecords() {
    for (let record of this.records.filter(elem => elem.headerFields.recordType === DB_RECORD_TYPE.TIME_CHANGE_RESULT )) {
      const oldDateTime = this.getDateTime(record.timeChangeFields.oldReaderTime, record.timeChangeFields.oldUserTimeOffset);

      const timeChange = this.cfg.builder.makeDeviceEventTimeChange()
        .with_change({
          from: sundial.formatDeviceTime(oldDateTime),
          to: record.headerFields.displayTime,
          agent: 'manual'
        })
        .with_deviceTime(record.headerFields.displayTime)
        .set('index', record.headerFields.recordNumber);
      this.postRecords.push(timeChange);
    }
  }

  buildCBGRecords() {
    for (let record of this.records.filter(elem => elem.headerFields.recordType === DB_RECORD_TYPE.HISTORICAL_DATA )) {
      const cbg = this.cfg.builder.makeCBG()
        .with_value(record.historyFields.glucoseValue)
        .with_units('mg/dL') // values are always in 'mg/dL', independent of the unitOfMeasure setting
        .with_deviceTime(record.headerFields.displayTime)
        .with_timezoneOffset(record.headerFields.timezoneOffset)
        .with_conversionOffset(record.headerFields.conversionOffset)
        .with_time(record.headerFields.displayUtc)
        .done();

      this.postRecords.push(cbg);
    }
  }

  handleDatabase(aapPacket) {
    if (aapPacket.dataLength === 0) {
      return;
    }

    let offset = 0;
    //const tableId = aapPacket.data[offset]; // not relevant
    offset += 1;

    const headerFields = struct.unpack(aapPacket.data, offset, FORMAT.RECORD_HEADER,
      ['recordNumber', 'recordType', 'isTimeValid', 'readerTime', 'userTimeOffset']);
    headerFields.isTimeValid = ((headerFields.isTimeValid & 0x80) > 0);
    offset += FORMAT_LENGTH.RECORD_HEADER;

    // TODO: handle time change events and adapt use of tzoUtil accordingly
    const dateTime = this.getDateTime(headerFields.readerTime, headerFields.userTimeOffset);
    headerFields.displayTime = sundial.formatDeviceTime(dateTime);

    if (headerFields.recordType === DB_RECORD_TYPE.TIME_CHANGE_RESULT) {
      const timeChangeFields = struct.unpack(aapPacket.data, offset, FORMAT.TIME_CHANGE,
        ['oldReaderTime', 'oldUserTimeOffset', 'valid', 'CRC16']);

        if (timeChangeFields.valid) {
          this.records.push({headerFields, timeChangeFields, dateTime});
        }
    }

    if (headerFields.recordType === DB_RECORD_TYPE.HISTORICAL_DATA) {
      const historyFields = struct.unpack(aapPacket.data, offset, FORMAT.HISTORICAL_DATA,
        ['glucoseValue', 'lifeCounter', 'dataQualityErrorFlags', 'CRC16']);
      historyFields.firstFlag = ((historyFields.glucoseValue & 0x1000) > 0);
      historyFields.timeChangeFlag = ((historyFields.glucoseValue & 0x2000) > 0);
      historyFields.foodFlag = ((historyFields.glucoseValue & 0x4000) > 0);
      historyFields.rapidActingInsulinFlag = ((historyFields.glucoseValue & 0x8000) > 0);
      historyFields.glucoseValue = (historyFields.glucoseValue & 0x03ff);

      // TODO: validate CRC16
      if (historyFields.dataQualityErrorFlags === 0) {
        //debug('handleDatabase: historyFields:', historyFields, aapPacket.data.toString('hex'));
        this.records.push({headerFields, historyFields, dateTime});
      }
    }
  }

  handleConfigSchema(aapPacket) {
    // ignored, since they are currently hardcoded based on the specs
  }

  handleConfigData(aapPacket) {
    let offset = 0;
    const tableId = aapPacket.data[offset];
    offset += 1;
    if (tableId === CFG_TABLE_ID.METER_FACTORY_CONFIGURATION) {
      const UNIT_OF_MEASURE_OFFSET = 133;
      const TIME_CONVERSION_OFFSET = 156;
      struct.unpack(aapPacket.data, offset + UNIT_OF_MEASURE_OFFSET, 'b', ['unitOfMeasure'], this.factoryConfig);
      this.factoryConfig.unitOfMeasure = ['mmol/L', 'mg/dL'][this.factoryConfig.unitOfMeasure];
      struct.unpack(aapPacket.data, offset + TIME_CONVERSION_OFFSET, 'i', ['timeConversion'], this.factoryConfig);
    }
  }

}
