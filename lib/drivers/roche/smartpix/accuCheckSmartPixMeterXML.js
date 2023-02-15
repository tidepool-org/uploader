import sundial from 'sundial';
import _ from 'lodash';

import {
  makeDebug, parseDtTm,
} from './accuChekSmartPixCommonXML';
import annotate from '../../../eventAnnotations';
import TZOUtil from '../../../TimezoneOffsetUtil';

const METER_NAMES = {
  'Aviva C': 'Aviva Combo',
};

function parseHeader(meterInfo) {
  const result = {
    bgUnit: _.trim(meterInfo.$.BGUnit),
    serialNumber: _.trim(meterInfo.$.SN),
    modelName: _.trim(meterInfo.$.Name),
  };

  if (meterInfo.$.CarbUnit) {
    let carbs = _.trim(meterInfo.$.CarbUnit);
    if (carbs !== 'g') {
      throw new Error(`Unhandled carbs unit: ${carbs}`);
    } else {
      carbs = 'grams';
    }
    result.carbUnit = carbs;
  }

  return result;
}

function parseFloat(value) {
  // BG may be "---".
  // Carbs may not exist.
  if (value !== undefined && value !== null && value !== '---') {
    return Number.parseFloat(value);
  }
  return null;
}

function parseBG(element, header, builder) {
  const entries = [];
  let annotation = null;

  let amount = parseFloat(element.$.Val);

  if (element.$.Val === 'LO') {
    amount = 19;
    annotation = {
      code: 'bg/out-of-range',
      value: 'low',
    };
  }

  if (element.$.Val === 'HI') {
    amount = 601;
    annotation = {
      code: 'bg/out-of-range',
      value: 'high',
    };
  }

  if ((amount != null) && (!element.$.Ctrl)) {
    const record = builder.makeSMBG()
      .with_value(amount)
      .with_units(header.bgUnit);

    if (annotation) {
      annotate.annotateEvent(record, annotation);
      annotate.annotateEvent(record, { code: 'bg/unknown-value' }); // unknown thresholds
    }

    entries.push(record);
  }

  const carbs = parseFloat(element.$.Carb);
  if (carbs != null) {
    entries.push(builder.makeFood()
      .with_nutrition({
        carbohydrate: {
          net: carbs,
          units: 'grams',
        },
      }));
  }

  return entries;
}

function parseBGData(bgdata, header, cfg) {
  const state = {
    DEBUG: false,
  };

  const entries = [];
  _.forEach(_.keys(bgdata), (indexStr) => {
    const i = indexStr - 0;
    const element = bgdata[i];
    let result = null;

    if (element['#name'] === 'BG') {
      result = parseBG(element, header, cfg.builder);
    }

    if (result !== null) {
      const time = parseDtTm(element.$);
      const objects = _.map(result, (item) => {
        let row = item
          .with_deviceTime(sundial.formatDeviceTime(time))
          .set('index', i);
        cfg.tzoUtil.fillInUTCInfo(row, time);
        row = row.done();
        delete row.index;
        return makeDebug(state, row, element);
      });
      entries.push(...objects);
    }
  });
  return entries;
}

export default function parseMeterData(document, cfg) {
  const root = document.IMPORT;
  const header = parseHeader(root.DEVICE[0]);

  const deviceId = `Roche-${header.modelName.replace(/\s+/g, '')}-${header.serialNumber}`;
  cfg.builder.setDefaults({ deviceId });

  const time = parseDtTm(root.DEVICE[0].$);

  const mostRecent = sundial.applyTimezone(time, cfg.timezone).toISOString();
  // eslint-disable-next-line no-param-reassign
  cfg.tzoUtil = new TZOUtil(cfg.timezone, mostRecent, []);

  const stream = parseBGData(root.BGDATA[0].$$, header, cfg);

  return {
    metadata: {
      modelName: header.modelName,
      model: METER_NAMES[header.modelName] || header.modelName,
      serialNumber: header.serialNumber,
      tags: ['bgm'],
      deviceId,
      time,
    },
    records: stream,
  };
}
