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

import {
  OP_CODE,
  ERROR_DESCRIPTION,
  DB_TABLE_ID,
  DB_WRAP_RECORDS,
  DB_RECORD_TYPE,
  CFG_TABLE_ID,
  RESULT_VALUE_TYPE,
  COMPRESSION_TYPE
} from './freeStyleLibreConstants';

const FORMAT = {
  ERROR: 'bb',
  DATE_TIME: 'bbbbbsb',
  RECORD_HEADER: 'sbbin',
  HISTORICAL_DATA: 'ssss',
  TIME_CHANGE: 'insss' // despite the specs, the user time offset is a signed value, same as in the header
};

const FORMAT_LENGTH = _.mapValues(FORMAT, format => { return struct.structlen(format); });

const OP_CODE_PROCESSING_ORDER = [
  //OP_CODE.GET_CFG_SCHEMA, // not used for now
  //OP_CODE.GET_DB_SCHEMA, // not used for now
  OP_CODE.GET_DATE_TIME,
  OP_CODE.GET_CFG_DATA,
  OP_CODE.COMPRESSED_DATABASE,
  OP_CODE.GET_DATABASE
];

const KETONE_VALUE_FACTOR = 18.0;

export class FreeStyleLibreData {

  constructor(cfg) {
    this.cfg = cfg;

    this.opCodeHandlers = {};
    this.opCodeHandlers[OP_CODE.GET_DATE_TIME] = this.handleDateTime.bind(this);
    this.opCodeHandlers[OP_CODE.GET_DB_SCHEMA] = this.handleDatabaseSchema.bind(this);
    this.opCodeHandlers[OP_CODE.COMPRESSED_DATABASE] = this.handleCompressedDatabase.bind(this);
    this.opCodeHandlers[OP_CODE.GET_DATABASE] = this.handleDatabase.bind(this);
    this.opCodeHandlers[OP_CODE.GET_CFG_SCHEMA] = this.handleConfigSchema.bind(this);
    this.opCodeHandlers[OP_CODE.GET_CFG_DATA] = this.handleConfigData.bind(this);
    this.opCodeHandlers[OP_CODE.ERROR] = this.constructor.handleError;

    this.factoryConfig = {};
    this.deviceDateTime = null;
    this.records = [];
    this.postRecords = [];

    this.dbRecordNumberNextWrap = {};
    this.oldestResultRecordNumber = Number.MAX_VALUE;
  }

  processAapPackets(aapPackets, dbRecordNumber) {
    // calculate next database record number wrap around, so record numbers can be recovered on truncated DBs
    const nextWrap = Math.ceil(dbRecordNumber / 0x10000) * 0x10000;
    this.dbRecordNumberNextWrap[DB_TABLE_ID.GLUCOSE_RESULT] = nextWrap;
    this.dbRecordNumberNextWrap[DB_TABLE_ID.RAPID_ACTING_INSULIN] = nextWrap;
    this.dbRecordNumberNextWrap[DB_TABLE_ID.HISTORICAL_DATA] = nextWrap;
    this.dbRecordNumberNextWrap[DB_TABLE_ID.EVENT] = nextWrap;

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
      if (opCode in aapPacketsByOpCode) {
        for (let aapPacket of aapPacketsByOpCode[opCode]) {
          const handler = this.opCodeHandlers[aapPacket['opCode']];
          if (handler) {
            handler(aapPacket);
          } else {
            debug('processAapPackets: no handler found for OP code:', aapPacket['opCode']);
          }
        }
      }
    }

    // use only records that are newer than the oldest record in the result DB
    // records older than that cannot be assigned proper timestamps due to the missing time change records
    this.records = this.records.filter(elem => elem.headerFields.recordNumber >= this.oldestResultRecordNumber);

    // sort records by record number to find the most recent one
    this.records.sort((a, b) => b.headerFields.recordNumber - a.headerFields.recordNumber);
    var timestamp = this.records[this.records.length - 1].jsDate;
    var mostRecent = sundial.applyTimezone(timestamp, this.cfg.timezone).toISOString();

    this.buildTimeChangeRecords();
    this.cfg.tzoUtil = new TZOUtil(this.cfg.timezone, mostRecent, this.postRecords);

    this.buildCBGRecords();
    this.buildMeasurementRecords();

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
          to: sundial.formatDeviceTime(record.jsDate),
          agent: 'manual'
        })
        .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
        .set('index', record.headerFields.recordNumber)
        .set('jsDate', record.jsDate);
      this.postRecords.push(timeChange);
    }
  }

  buildCBGRecords() {
    for (let record of this.records.filter(elem => elem.headerFields.recordType === DB_RECORD_TYPE.HISTORICAL_DATA )) {
      const cbg = this.cfg.builder.makeCBG()
        .with_value(record.historyFields.glucoseValue)
        .with_units('mg/dL') // values are always in 'mg/dL', independent of the unitOfMeasure setting
        .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
        .set('index', record.headerFields.recordNumber)
        .set('timeChangeFlag', record.historyFields.timeChangeFlag)
        .set('jsDate', record.jsDate);

      this.cfg.tzoUtil.fillInUTCInfo(cbg, record.jsDate);
      this.postRecords.push(cbg.done());
    }
  }

  buildMeasurementRecords() {
    for (let record of this.records.filter(elem =>
      [DB_RECORD_TYPE.GLUCOSE_KETONE_SERVING,
        DB_RECORD_TYPE.GLUCOSE_KETONE_MEAL,
        DB_RECORD_TYPE.GLUCOSE_KETONE_CARBS
      ].includes(elem.headerFields.recordType))) {

      let recordBuilder;

      if (record.measurementFields.resultType === RESULT_VALUE_TYPE.GLUCOSE) {

        recordBuilder = this.cfg.builder.makeSMBG()
          .with_value(record.measurementFields.resultValue)
          .with_units('mg/dL'); // values are always in 'mg/dL', independent of the unitOfMeasure setting

      } else if (record.measurementFields.resultType === RESULT_VALUE_TYPE.KETONE) {

        recordBuilder = this.cfg.builder.makeBloodKetone()
          .with_value(record.measurementFields.resultValue / KETONE_VALUE_FACTOR)
          .with_units('mmol/L');
      }

      if (recordBuilder) {
        recordBuilder = recordBuilder.with_deviceTime(sundial.formatDeviceTime(record.jsDate))
                  .set('index', record.headerFields.recordNumber)
                  .set('jsDate', record.jsDate);
        this.cfg.tzoUtil.fillInUTCInfo(recordBuilder, record.jsDate);
        this.postRecords.push(recordBuilder.done());
      }
    }
  }

  handleCompressedDatabase(aapPacket) {
    let decompressedBuffer = new Buffer(1);
    let compressedOffset = 0;

    // copy table ID
    decompressedBuffer[0] = aapPacket.data[compressedOffset];
    compressedOffset++;

    while (compressedOffset < aapPacket.dataLength) {
      const blockType = aapPacket.data[compressedOffset];
      compressedOffset++;

      // parse 24 bit little endian block length
      let blockLength = aapPacket.data[compressedOffset]
        | (aapPacket.data[compressedOffset + 1] << 8)
        | (aapPacket.data[compressedOffset + 2] << 16);
      compressedOffset += 3;

      blockLength *= 4; // convert number of uint32 values to number of uint8 values

      if (blockType === COMPRESSION_TYPE.UNCOMPRESSED) {

        decompressedBuffer = Buffer.concat(
          [decompressedBuffer, aapPacket.data.slice(compressedOffset, compressedOffset + blockLength)]);
        compressedOffset += blockLength;

      } else if (blockType === COMPRESSION_TYPE.ZERO_COMPRESSED) {

        decompressedBuffer = Buffer.concat([decompressedBuffer, Buffer.alloc(blockLength)]);
        compressedOffset += blockLength;

      } else {
        debug('handleCompressedDatabase: failed to decompress!');
        return;
      }
    }

    // build decompressed AAP packet to process
    const decompressedAapPacket = {
      packetLength: aapPacket.packetLength - aapPacket.dataLength + aapPacket.data.length,
      data: decompressedBuffer,
      dataLength: aapPacket.data.length,
      opCode: OP_CODE.GET_DATABASE
    };

    this.handleDatabase(decompressedAapPacket);
  }

  handleDatabase(aapPacket) {
    if (aapPacket.dataLength === 0) {
      return;
    }

    let offset = 0;
    const databaseTableId = aapPacket.data[offset];
    offset += 1;

    const headerFields = struct.unpack(aapPacket.data, offset, FORMAT.RECORD_HEADER,
      ['recordNumber', 'recordType', 'isTimeValid', 'readerTime', 'userTimeOffset']);
    headerFields.isTimeValid = ((headerFields.isTimeValid & 0x80) > 0);
    offset += FORMAT_LENGTH.RECORD_HEADER;

    // calculate actual 32bit record number from 16bit header record number and next wrap around number
    headerFields.recordNumber = this.dbRecordNumberNextWrap[databaseTableId] - (0x10000 - headerFields.recordNumber);

    // find the lowest record number int the results database
    if (databaseTableId === DB_TABLE_ID.GLUCOSE_RESULT) {
      this.oldestResultRecordNumber = Math.min(this.oldestResultRecordNumber, headerFields.recordNumber);
    }

    const dateTime = this.getDateTime(headerFields.readerTime, headerFields.userTimeOffset);

    if (headerFields.recordType === DB_RECORD_TYPE.TIME_CHANGE_RESULT) {
      const timeChangeFields = struct.unpack(aapPacket.data, offset, FORMAT.TIME_CHANGE,
        ['oldReaderTime', 'oldUserTimeOffset', 'valid', 'unused', 'CRC16']);

      // TODO: validate CRC16
      if (timeChangeFields.valid) {
        this.records.push({headerFields, timeChangeFields, jsDate : dateTime});
      }

    } else if (headerFields.recordType === DB_RECORD_TYPE.HISTORICAL_DATA) {

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
        this.records.push({headerFields, historyFields, jsDate : dateTime});
      }

    } else if ([DB_RECORD_TYPE.GLUCOSE_KETONE_SERVING,
        DB_RECORD_TYPE.GLUCOSE_KETONE_MEAL,
        DB_RECORD_TYPE.GLUCOSE_KETONE_CARBS
      ].includes(headerFields.recordType)) {

      const measurementFields = {};
      const RESULT_VALUE_OFFSET = 0;
      struct.unpack(aapPacket.data, offset + RESULT_VALUE_OFFSET, 's', ['resultValue'], measurementFields);
      measurementFields.resultType = (measurementFields.resultValue >> 14) & 0x3;
      measurementFields.resultValue = (measurementFields.resultValue & 0x03ff);

      const DATA_QUALITY_ERROR_FLAGS_OFFSET = 10;
      struct.unpack(aapPacket.data, offset + DATA_QUALITY_ERROR_FLAGS_OFFSET, 's', ['dataQualityErrorFlags'], measurementFields);

      // TODO: validate CRC16
      if (measurementFields.dataQualityErrorFlags === 0) {
        this.records.push({headerFields, measurementFields, jsDate : dateTime});
      }

    } else if (headerFields.recordType in DB_WRAP_RECORDS) {

      const DB_RECORD_NUMBER_OFFSET = 0;
      // TODO: validate CRC16
      this.dbRecordNumberNextWrap[databaseTableId] = aapPacket.data.readUInt32LE(offset + DB_RECORD_NUMBER_OFFSET);

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
      struct.unpack(aapPacket.data, offset + UNIT_OF_MEASURE_OFFSET, 'b', ['unitOfMeasure'], this.factoryConfig);
      this.factoryConfig.unitOfMeasure = ['mmol/L', 'mg/dL'][this.factoryConfig.unitOfMeasure];

      const TIME_CONVERSION_OFFSET = 156;
      struct.unpack(aapPacket.data, offset + TIME_CONVERSION_OFFSET, 'i', ['timeConversion'], this.factoryConfig);
    }
  }

}
