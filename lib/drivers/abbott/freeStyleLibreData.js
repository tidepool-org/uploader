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

import {OP_CODE, ERROR_DESCRIPTION, RECORD_TYPE, CFG_TABLE_ID} from './freeStyleLibreConstants';

const FORMAT = {
  ERROR: 'bb',
  DATE_TIME: 'bbbbbsb',
  RECORD_HEADER: 'sbbin',
  HISTORICAL_DATA: 'ssss',
};

const FORMAT_LENGTH = _.mapValues(FORMAT, format => { return struct.structlen(format); });

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
    this.postRecords = [];
  }

  processAapPackets(aapPackets) {
    // TODO: date & time settings changes are available
    // change timezone calculation accordingly
    this.cfg.tzoUtil = new TZOUtil(this.cfg.timezone, new Date().toISOString(), []);

    // TODO: handle packets in fixed order: date time, cfg tables, database

    for (let aapPacket of aapPackets) {
      const handler = this.opCodeHandlers[aapPacket['opCode']];
      if (handler) {
        handler(aapPacket);
      } else {
        debug('processAapPackets: no handler found for OP code:', aapPacket['opCode']);
      }
    }
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
    // these are ignored for now, as the schemata are already know from the specs
    // for now they are hardcoded based on the specs for the few record types that are actually needed
  }

  handleDatabase(aapPacket) {
    if (aapPacket.dataLength === 0) {
      return;
    }

    let offset = 0;
    //const tableId = aapPacket.data[offset];
    offset += 1;

    const headerFields = struct.unpack(aapPacket.data, offset, FORMAT.RECORD_HEADER,
      ['recordNumber', 'recordType', 'isTimeValid', 'readerTime', 'userTimeOffset']);
    headerFields.isTimeValid = ((headerFields.isTimeValid & 0x80) > 0);
    offset += FORMAT_LENGTH.RECORD_HEADER;

    // TODO: handle time change events and adapt use of tzoUtil accordingly
    const unixTimestamp = this.factoryConfig.timeConversion + headerFields.readerTime + headerFields.userTimeOffset;
    const dateTime = new Date(unixTimestamp * 1000);
    headerFields.displayTime = sundial.formatDeviceTime(new Date(dateTime).toISOString());
    const utcInfo = this.cfg.tzoUtil.lookup(dateTime);
    headerFields.displayUtc = utcInfo.time;
    headerFields.timezoneOffset = utcInfo.timezoneOffset;
    headerFields.conversionOffset = utcInfo.conversionOffset;

    if (headerFields.recordType === RECORD_TYPE.HISTORICAL_DATA_SCHEMA) {
      const historyFields = struct.unpack(aapPacket.data, offset, FORMAT.HISTORICAL_DATA,
        ['glucoseValue', 'lifeCounter', 'dataQualityErrorFlags', 'CRC16']);
      historyFields.firstFlag = ((historyFields.glucoseValue & 0x1000) > 0);
      historyFields.timeChangeFlag = ((historyFields.glucoseValue & 0x2000) > 0);
      historyFields.foodFlag = ((historyFields.glucoseValue & 0x4000) > 0);
      historyFields.RAI = ((historyFields.glucoseValue & 0x8000) > 0);
      historyFields.glucoseValue = (historyFields.glucoseValue & 0x03ff);

      if (historyFields.dataQualityErrorFlags === 0) {
        //debug('handleDatabase: historyFields:', historyFields, aapPacket.data.toString('hex'));

        const cbg = this.cfg.builder.makeCBG()
          .with_value(historyFields.glucoseValue)
          .with_units(this.factoryConfig.unitOfMeasure)
          .with_deviceTime(headerFields.displayTime)
          .with_timezoneOffset(headerFields.timezoneOffset)
          .with_conversionOffset(headerFields.conversionOffset)
          .with_time(headerFields.displayUtc)
          .done();

        this.postRecords.push(cbg);
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
