import sundial from 'sundial';
import _ from 'lodash';
import objectBuilder from '../../../objectBuilder';
import {
  makeDebug, parseDtTm,
} from './accuChekSmartPixCommonXML';

const METER_NAMES = {
  'Aviva C': 'Aviva Combo',
};

function parseHeader(meterInfo, context) {
  let carbs = _.trim(meterInfo.$.CarbUnit);
  if (carbs !== 'g') {
    throw new Error(`Unhandled carbs unit: ${carbs}`);
  } else {
    carbs = 'grams';
  }
  return {
    bgUnit: _.trim(meterInfo.$.BGUnit),
    carbUnit: carbs,
    serialNumber: _.trim(meterInfo.$.SN),
    modelName: _.trim(meterInfo.$.Name),
    context,
  };
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

  const amount = parseFloat(element.$.Val);
  if (amount != null) {
    entries.push(builder.makeSMBG()
      .with_value(amount)
      .with_units(header.bgUnit));
  }

  const carbs = parseFloat(element.$.Carb);
  if (carbs != null) {
    entries.push(builder.makeFood()
      .with_amount(carbs));
  }

  return entries;
}

function parseBGData(bgdata, header, builder) {
  const state = {
    DEBUG: false,
  };

  const entries = [];
  _.forEach(_.keys(bgdata), (indexStr) => {
    const i = indexStr - 0;
    const element = bgdata[i];
    let result = null;

    if (element['#name'] === 'BG') {
      result = parseBG(element, header, builder);
    }

    if (result !== null) {
      const time = parseDtTm(element.$);
      const objects = _.map(result, (item) => {
        const row = item
          .with_deviceTime(sundial.formatDeviceTime(time))
          .with_time(sundial.applyTimezone(time, header.context.timezone).toISOString())
          .with_timezoneOffset(sundial.getOffsetFromZone(time, header.context.timezone))
          .with_conversionOffset(0)
          .done();
        return makeDebug(state, row, element);
      });
      entries.push(...objects);
    }
  });
  return entries;
}

export default function parseMeterData(document, context, builder) {
  const theBuilder = builder || objectBuilder();

  // log(util.inspect(root.BGDATA, false, null));
  const root = document.IMPORT;
  const records = [];
  const header = parseHeader(root.DEVICE[0], context);

  const deviceId = `${header.modelName}:${header.serialNumber}`;
  theBuilder.setDefaults({ deviceId });

  const time = parseDtTm(root.DEVICE[0].$);

  const currentSettings = theBuilder.makePumpSettings() // FIXME: Not a pump. Missing fields.
    .with_activeSchedule('')
    .with_deviceTime(sundial.formatDeviceTime(time))
    .with_time(sundial.applyTimezone(time, header.context.timezone).toISOString())
    .with_timezoneOffset(sundial.getOffsetFromZone(time, header.context.timezone))
    .with_conversionOffset(0)
    .with_manufacturers(context.manufacturers)
    .with_serialNumber(header.serialNumber)
    .with_units({ bg: header.bgUnit, carbs: header.carbUnit })
    .done();
  records.push(currentSettings);

  const stream = parseBGData(root.BGDATA[0].$$, header, theBuilder);

  // log(JSON.stringify(header, null, 2));
  // log(JSON.stringify(stream, null, 2));
  return {
    metadata: {
      modelName: header.modelName,
      model: METER_NAMES[header.modelName] || header.modelName,
      serialNumber: header.serialNumber,
      tags: ['meter'],
      deviceId,
    },
    records: records.concat(stream),
  };
}
