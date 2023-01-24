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

import structJs from '../../struct';
import TZOUtil from '../../TimezoneOffsetUtil';
import annotate from '../../eventAnnotations';

import {
  OP_CODE,
  ERROR_DESCRIPTION,
  DB_TABLE_ID,
  DB_WRAP_RECORDS,
  DB_RECORD_TYPE,
  CFG_TABLE_ID,
  RESULT_VALUE_TYPE,
  COMPRESSION_TYPE,
  KETONE_VALUE_FACTOR,
  KETONE_HI,
  KETONE_LO,
  GLUCOSE_HI,
  GLUCOSE_LO,
  CRC16_TABLE,
} from './freeStyleLibreConstants';
import FreeStyleLibreProtocol from './freeStyleLibreProtocol';

const struct = structJs();

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('FreeStyleLibreDriver') : console.log;

const FORMAT = {
  ERROR: 'bb',
  DATE_TIME: 'bbbbbsb',
  RECORD_HEADER: 'sbbin',
  HISTORICAL_DATA: 'ssss',
  TIME_CHANGE: 'insss', // despite the specs, user time offset is a signed value, same as in header
  USER_TIME_CHANGE: 'nssss',
};

export const FORMAT_LENGTH = _.mapValues(FORMAT, format => struct.structlen(format));

const OP_CODE_PROCESSING_ORDER = [
  OP_CODE.GET_CFG_SCHEMA, // not used for now
  OP_CODE.GET_DB_SCHEMA, // not used for now
  OP_CODE.GET_DATE_TIME,
  OP_CODE.GET_CFG_DATA,
  OP_CODE.COMPRESSED_DATABASE,
  OP_CODE.GET_DATABASE,
];

export default class FreeStyleLibreData {
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
  }

  processAapPackets(aapPackets, dbRecordNumber) {
    this.factoryConfig = {};
    this.deviceDateTime = null;
    this.records = [];
    this.postRecords = [];

    this.dbRecordNumberNextWrap = {};

    // calculate next DB record number wrap, so record numbers can be recovered on truncated DBs
    const nextWrap = Math.ceil(dbRecordNumber / 0x10000) * 0x10000;
    this.dbRecordNumberNextWrap[DB_TABLE_ID.GLUCOSE_RESULT] = nextWrap;
    this.dbRecordNumberNextWrap[DB_TABLE_ID.RAPID_ACTING_INSULIN] = nextWrap;
    this.dbRecordNumberNextWrap[DB_TABLE_ID.HISTORICAL_DATA] = nextWrap;
    this.dbRecordNumberNextWrap[DB_TABLE_ID.EVENT] = nextWrap;

    // sort AAP packets by their OP code
    const aapPacketsByOpCode = {};
    aapPackets.forEach((aapPacket) => {
      const { opCode } = aapPacket;
      if (!(opCode in aapPacketsByOpCode)) {
        aapPacketsByOpCode[opCode] = [];
      }
      aapPacketsByOpCode[opCode].push(aapPacket);
    });

    // process AAP packet in fixed order to make sure data is available when needed
    OP_CODE_PROCESSING_ORDER.forEach((opCode) => {
      if (opCode in aapPacketsByOpCode) {
        aapPacketsByOpCode[opCode].forEach((aapPacket) => {
          const handler = this.opCodeHandlers[aapPacket.opCode];
          if (handler) {
            handler(aapPacket);
          } else {
            debug('processAapPackets: no handler found for OP code:', aapPacket.opCode);
          }
        });
      }
    });

    if (this.records.length === 0) {
      debug(
        'processAapPackets: no valid database records found in',
        aapPackets.length, 'AAP packets.',
      );
      return [];
    }

    // sort records ascending by record number to honor the timeChangeFlag
    this.records.sort((a, b) => a.headerFields.recordNumber - b.headerFields.recordNumber);

    // if timeChangeFlag is set, set record number of previous history record lower than the
    // previous time change record
    // this prevents these records from being bootstrapped with the wrong timezone
    let previousTimeChangeRecord = null;
    let previousHistoryRecord = null;
    this.records.forEach((record) => {
      if (record.historyFields) {
        if (record.historyFields.timeChangeFlag && previousTimeChangeRecord && previousHistoryRecord) {
          previousHistoryRecord.headerFields.recordNumber =
            previousTimeChangeRecord.headerFields.recordNumber - 1;
        }
        previousHistoryRecord = record;
      } else if (record.timeChangeFields) {
        previousTimeChangeRecord = record;
      }
    });

    // sort records again ascending by record number to find the most recent one
    this.records.sort((a, b) => a.headerFields.recordNumber - b.headerFields.recordNumber);
    const timestamp = this.records[this.records.length - 1].jsDate;
    const mostRecent = sundial.applyTimezone(timestamp, this.cfg.timezone).toISOString();

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
    const fields = struct.unpack(
      aapPacket.data, 0, FORMAT.DATE_TIME,
      ['second', 'minute', 'hour', 'day', 'month', 'year', 'valid'],
    );
    if (fields.valid !== 1) {
      debug('handleDateTime: date not marked as valid:', fields.valid, aapPacket.data.data[0]);
      return;
    }
    this.deviceDateTime = new Date(
      fields.year, fields.month - 1, fields.day,
      fields.hour, fields.minute, fields.second,
    );
    debug('handleDateTime: datetime:', this.deviceDateTime);
  }

  // eslint-disable-next-line no-unused-vars,class-methods-use-this
  handleDatabaseSchema(aapPacket) {
    /*
     * These are ignored for now, as the schemata are already known from the specs.
     * For now they are hardcoded based on the specs for the few record types that are actually
     * needed.
     *
     * The schemata describe the fields in the database records, so that using this information to
     * parse the records instead of the hardcoded format strings, would make it possible to
     * understand the data even after a potential firmware upgrade that changes the database
     * structure.
     * (As long as the field IDs stay the same, the fields parsed via these schemata can still be
     * evaluated properly.)
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
          // [uint16_le], [uint16_le], [uint8],                    [uint8],   [uint16_le]
          // field ID,    word offset, bit offset inside the word, data type, data length in bits
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
    let timeChanges = this.records.filter(elem =>
      (elem.headerFields.recordType === DB_RECORD_TYPE.TIME_CHANGE_RESULT) ||
      (elem.headerFields.recordType === DB_RECORD_TYPE.USER_TIME_CHANGE));

    // because the time changes exist in multiple DBs there will be duplicates
    timeChanges = _.uniqBy(timeChanges, o =>
      o.headerFields.readerTime + o.headerFields.userTimeOffset);

    for (let i = 0; i < timeChanges.length; i++) {
      let record = timeChanges[i];

      const oldDateTime = this.getDateTime(
        record.timeChangeFields.oldReaderTime,
        record.timeChangeFields.oldUserTimeOffset,
      );

      const nextChange = timeChanges[i + 1];

      if (nextChange) {
        const distance = nextChange.headerFields.recordNumber - record.headerFields.recordNumber;
        // even if combined date/time changes are made directly after another,
        // they should still be more than 50 records apart
        const DISTANCE_THRESHOLD = 50;

        if (distance < DISTANCE_THRESHOLD) {
          // check that either date () or time (HH:mm) is the same
          if ((record.jsDate.getFullYear() === nextChange.jsDate.getFullYear() &&
               record.jsDate.getDay() === nextChange.jsDate.getDay() &&
               record.jsDate.getMonth() === nextChange.jsDate.getMonth()) ||
              (record.jsDate.getHours() === nextChange.jsDate.getHours() &&
               record.jsDate.getMinutes() === nextChange.jsDate.getMinutes())) {
            debug(
              'Combining time changes at', sundial.formatDeviceTime(record.jsDate),
              'and', sundial.formatDeviceTime(nextChange.jsDate),
            );
            i += 1;
            record = timeChanges[i];
          }
        }
      }

      const timeChange = this.cfg.builder.makeDeviceEventTimeChange()
        .with_change({
          from: sundial.formatDeviceTime(oldDateTime),
          to: sundial.formatDeviceTime(record.jsDate),
          agent: 'manual',
        })
        .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
        .set('index', record.headerFields.recordNumber)
        .set('jsDate', record.jsDate);

      this.postRecords.push(timeChange);
    }
  }

  static addOutOfRangeAnnotation(recordBuilder, low, high, step, type) {
    if (low !== null && recordBuilder.value < low + step) {
      recordBuilder.with_value(low);
      annotate.annotateEvent(recordBuilder, {
        code: `${type}/out-of-range`,
        value: 'low',
        threshold: low + step,
      });
    } else if (high !== null && recordBuilder.value > high - step) {
      recordBuilder.with_value(high);
      annotate.annotateEvent(recordBuilder, {
        code: `${type}/out-of-range`,
        value: 'high',
        threshold: high - step,
      });
    }
  }

  buildCBGRecords() {
    this.records.filter(elem => elem.headerFields.recordType === DB_RECORD_TYPE.HISTORICAL_DATA)
      .forEach((record) => {
        const cbg = this.cfg.builder.makeCBG()
          .with_value(record.historyFields.glucoseValue)
          .with_units('mg/dL') // values are always in 'mg/dL', independent of the unitOfMeasure setting
          .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
          .set('index', record.headerFields.recordNumber);

        this.constructor.addOutOfRangeAnnotation(cbg, GLUCOSE_LO, GLUCOSE_HI, 1, 'bg');

        this.cfg.tzoUtil.fillInUTCInfo(cbg, record.jsDate);
        this.postRecords.push(cbg.done());
      });
  }

  buildMeasurementRecords() {
    this.records.filter(elem =>
      [DB_RECORD_TYPE.GLUCOSE_KETONE_SERVING,
        DB_RECORD_TYPE.GLUCOSE_KETONE_MEAL,
        DB_RECORD_TYPE.GLUCOSE_KETONE_CARBS,
      ].includes(elem.headerFields.recordType)).forEach((record) => {
      let recordBuilder;

      if (record.measurementFields.resultType === RESULT_VALUE_TYPE.GLUCOSE ||
          record.measurementFields.resultType === RESULT_VALUE_TYPE.SCAN) {
        recordBuilder = this.cfg.builder.makeSMBG()
          .with_value(record.measurementFields.resultValue)
          .with_units('mg/dL'); // values are always in 'mg/dL', independent of the unitOfMeasure setting

        this.constructor.addOutOfRangeAnnotation(recordBuilder, GLUCOSE_LO, GLUCOSE_HI, 1, 'bg');

        if (record.measurementFields.resultType === RESULT_VALUE_TYPE.SCAN) {
          recordBuilder.with_subType('scanned');
        }
      } else if (record.measurementFields.resultType === RESULT_VALUE_TYPE.KETONE) {
        recordBuilder = this.cfg.builder.makeBloodKetone()
          .with_value(record.measurementFields.resultValue / KETONE_VALUE_FACTOR)
          .with_units('mmol/L');

        this.constructor.addOutOfRangeAnnotation(recordBuilder, KETONE_LO, KETONE_HI, 1 / KETONE_VALUE_FACTOR, 'ketone');
      }

      if (recordBuilder) {
        recordBuilder = recordBuilder.with_deviceTime(sundial.formatDeviceTime(record.jsDate))
          .set('index', record.headerFields.recordNumber);
        this.cfg.tzoUtil.fillInUTCInfo(recordBuilder, record.jsDate);
        this.postRecords.push(recordBuilder.done());
      }
    });
  }

  handleCompressedDatabase(aapPacket) {
    let decompressedBuffer = [];
    let compressedOffset = 0;

    // get table ID
    const tableId = aapPacket.data[compressedOffset];
    compressedOffset += 1;

    const CRC32_LENGTH = 4;
    while (compressedOffset < aapPacket.dataLength - CRC32_LENGTH) {
      const blockType = aapPacket.data[compressedOffset];
      compressedOffset += 1;

      // parse 24 bit little endian block length
      /* eslint-disable no-bitwise */
      let blockLength = aapPacket.data[compressedOffset]
        | (aapPacket.data[compressedOffset + 1] << 8)
        | (aapPacket.data[compressedOffset + 2] << 16);
      /* eslint-enable no-bitwise */
      compressedOffset += 3;

      blockLength *= 4; // convert number of uint32 values to number of uint8 values

      if (blockType === COMPRESSION_TYPE.UNCOMPRESSED) {
        decompressedBuffer = decompressedBuffer.concat(
          aapPacket.data.slice(compressedOffset, compressedOffset + blockLength),
        );
        compressedOffset += blockLength;
      } else if (blockType === COMPRESSION_TYPE.ZERO_COMPRESSED) {
        decompressedBuffer = decompressedBuffer.concat(new Array(blockLength));
      } else {
        debug('handleCompressedDatabase: failed to decompress!');
        throw new Error('Failed to decompress.');
      }
    }

    // validate CRC32 of uncompressed data
    const readCrc32 = struct.extractInt(aapPacket.data, compressedOffset);
    const calcCrc32 = FreeStyleLibreProtocol.calcCrc32(decompressedBuffer);
    if (readCrc32 !== calcCrc32) {
      debug('handleCompressedDatabase: invalid CRC32!');
      return;
    }

    // build decompressed AAP packet to process
    decompressedBuffer.unshift(tableId);
    const decompressedAapPacket = {
      packetLength: (aapPacket.packetLength - aapPacket.dataLength) + decompressedBuffer.length,
      data: decompressedBuffer,
      dataLength: decompressedBuffer.length,
      opCode: OP_CODE.GET_DATABASE,
    };

    this.handleDatabase(decompressedAapPacket);
  }

  /* eslint-disable no-bitwise */
  static calcCrc16(data) {
    let residue = 0xffff;

    data.forEach((byte) => {
      const tableIndex = (residue & 0xff) ^ byte;
      residue >>= 8;
      residue ^= CRC16_TABLE[tableIndex];
    });

    // copy the bits of the residue into the crc16 in reverse order
    let crc16 = 0;
    for (let i = 0; i < 16; i++) {
      crc16 = (crc16 << 1) | ((residue >> i) & 0x0001);
    }

    return crc16;
  }

  checkCrc16(data, crc16) {
    const calculatedCrc16 =
      this.constructor.calcCrc16(data);
    if (crc16 !== calculatedCrc16) {
      debug('checkCrc16: Error:', crc16.toString(16), '!=', calculatedCrc16.toString(16));
      return false;
    }
    return true;
  }

  handleDatabase(aapPacket) {
    if (aapPacket.dataLength === 0) {
      return;
    }

    const TABLE_ID_OFFSET = 0;
    const TABLE_ID_LENGTH = 1;
    const databaseTableId = aapPacket.data[TABLE_ID_OFFSET];

    const RECORD_HEADER_OFFSET = TABLE_ID_LENGTH;
    const headerFields = struct.unpack(
      aapPacket.data, RECORD_HEADER_OFFSET, FORMAT.RECORD_HEADER,
      ['recordNumber', 'recordType', 'isTimeValid', 'readerTime', 'userTimeOffset'],
    );
    headerFields.isTimeValid = ((headerFields.isTimeValid & 0x80) > 0);

    const RECORD_OFFSET = RECORD_HEADER_OFFSET + FORMAT_LENGTH.RECORD_HEADER;

    // calculate 32bit record number from 16bit header record number and next wrap around number
    headerFields.recordNumber =
      this.dbRecordNumberNextWrap[databaseTableId] - (0x10000 - headerFields.recordNumber);

    const dateTime = this.getDateTime(headerFields.readerTime, headerFields.userTimeOffset);

    if (headerFields.recordType === DB_RECORD_TYPE.TIME_CHANGE_RESULT) {
      const timeChangeFields = struct.unpack(
        aapPacket.data, RECORD_OFFSET, FORMAT.TIME_CHANGE,
        ['oldReaderTime', 'oldUserTimeOffset', 'valid', 'unused', 'CRC16'],
      );

      if (this.checkCrc16(aapPacket.data.slice(
        RECORD_HEADER_OFFSET,
        RECORD_OFFSET + (FORMAT_LENGTH.TIME_CHANGE - 2),
      ), timeChangeFields.CRC16)) {
        if (timeChangeFields.valid) {
          this.records.push({ headerFields, timeChangeFields, jsDate: dateTime });
        }
      }
    } else if (headerFields.recordType === DB_RECORD_TYPE.USER_TIME_CHANGE) {
      const timeChangeFields = struct.unpack(
        aapPacket.data, RECORD_OFFSET, FORMAT.USER_TIME_CHANGE,
        ['oldUserTimeOffset', 'unused1', 'unused2', 'unused3', 'CRC16'],
      );

      if (this.checkCrc16(aapPacket.data.slice(
        RECORD_HEADER_OFFSET,
        RECORD_OFFSET + (FORMAT_LENGTH.USER_TIME_CHANGE - 2),
      ), timeChangeFields.CRC16)) {
        // reader time does not change on user time change events, so use current value
        timeChangeFields.oldReaderTime = headerFields.readerTime;
        this.records.push({ headerFields, timeChangeFields, jsDate: dateTime });
      }
    } else if (headerFields.recordType === DB_RECORD_TYPE.HISTORICAL_DATA) {
      const historyFields = struct.unpack(
        aapPacket.data, RECORD_OFFSET, FORMAT.HISTORICAL_DATA,
        ['glucoseValue', 'lifeCounter', 'dataQualityErrorFlags', 'CRC16'],
      );
      historyFields.firstFlag = ((historyFields.glucoseValue & 0x1000) > 0);
      historyFields.timeChangeFlag = ((historyFields.glucoseValue & 0x2000) > 0);
      historyFields.foodFlag = ((historyFields.glucoseValue & 0x4000) > 0);
      historyFields.rapidActingInsulinFlag = ((historyFields.glucoseValue & 0x8000) > 0);
      historyFields.glucoseValue &= 0x03ff;

      if (this.checkCrc16(aapPacket.data.slice(
        RECORD_HEADER_OFFSET,
        RECORD_OFFSET + (FORMAT_LENGTH.HISTORICAL_DATA - 2),
      ), historyFields.CRC16)) {
        if (historyFields.dataQualityErrorFlags === 0) {
          this.records.push({ headerFields, historyFields, jsDate: dateTime });
        }
      }
    } else if ([DB_RECORD_TYPE.GLUCOSE_KETONE_SERVING,
      DB_RECORD_TYPE.GLUCOSE_KETONE_MEAL,
      DB_RECORD_TYPE.GLUCOSE_KETONE_CARBS,
    ].includes(headerFields.recordType)) {
      const measurementFields = {};
      const RESULT_VALUE_OFFSET = 0;
      struct.unpack(
        aapPacket.data, RECORD_OFFSET + RESULT_VALUE_OFFSET, 's', ['resultValue'],
        measurementFields,
      );
      measurementFields.resultType = (measurementFields.resultValue >> 14) & 0x3;
      measurementFields.resultValue &= 0x03ff;

      const DATA_QUALITY_ERROR_FLAGS_OFFSET = 10;
      struct.unpack(
        aapPacket.data, RECORD_OFFSET + DATA_QUALITY_ERROR_FLAGS_OFFSET, 's',
        ['dataQualityErrorFlags'], measurementFields,
      );

      const CRC_OFFSET = 12;
      struct.unpack(aapPacket.data, RECORD_OFFSET + CRC_OFFSET, 's', ['CRC16'], measurementFields);
      if (this.checkCrc16(
        aapPacket.data.slice(RECORD_HEADER_OFFSET, RECORD_OFFSET + CRC_OFFSET),
        measurementFields.CRC16,
      )) {
        if (measurementFields.dataQualityErrorFlags === 0) {
          this.records.push({ headerFields, measurementFields, jsDate: dateTime });
        }
      }
    } else if (headerFields.recordType in DB_WRAP_RECORDS) {
      const wrapFields = {};

      const { CRC_OFFSET } = DB_WRAP_RECORDS[headerFields.recordType];
      struct.unpack(aapPacket.data, RECORD_OFFSET + CRC_OFFSET, 's', ['CRC16'], wrapFields);

      if (this.checkCrc16(
        aapPacket.data.slice(RECORD_HEADER_OFFSET, RECORD_OFFSET + CRC_OFFSET),
        wrapFields.CRC16,
      )) {
        const DB_RECORD_NUMBER_OFFSET = 0;
        const nextDbRecordNumber = struct.extractInt(
          aapPacket.data,
          RECORD_OFFSET + DB_RECORD_NUMBER_OFFSET,
        );
        // contrary to the specs nextDbRecordNumber is not always a multiple of 0x10000, but in fact
        // just the record number that will be assigned to the next db record
        // so we round it up to the next multiple of 0x10000 here
        this.dbRecordNumberNextWrap[databaseTableId] =
          Math.ceil(nextDbRecordNumber / 0x10000) * 0x10000;
      }
    }
  }
  /* eslint-enable no-bitwise */

  // eslint-disable-next-line no-unused-vars,class-methods-use-this
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
