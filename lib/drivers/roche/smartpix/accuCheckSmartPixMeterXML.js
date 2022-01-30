import sundial from 'sundial';
import _ from 'lodash';
import objectBuilder from '../../../objectBuilder';
import {
  ALARM_TYPES, makeDebug, parseDtTm,
} from './accuChekSmartPixCommonXML';
import parseBasal from './acspBasal';
import parseBolusInfo from './acspBolus';

const METER_NAMES = {
  'Aviva C': 'Aviva Combo',
};

function parseHeader(meterInfo) {
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
      .with_units(header.bgUnit)
    );
  }

  const carbs = parseFloat(element.$.Carb);
  if (carbs != null) {
    entries.push(builder.makeFood()
      .with_carbs(carbs)
    );
  }

  return entries;
}

function parseBGData(bgdata, header, builder) {
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
      _.forEach(result, (element) => {
        element = element
          .with_deviceTime(sundial.formatDeviceTime(time))
          .with_time(sundial.applyTimezone(time, 'Europe/Helsinki')) // FIXME: TZ and conversion
          .with_timezoneOffset(120) // FIXME: TZ offset
          .with_clockDriftOffset(0)
          .with_conversionOffset(0);
        entries.push(element.done());
      });
    }
  });
  return entries;
}

export function parseMeterData(document, cfg, builder) {
  const theBuilder = builder || objectBuilder();

  // log(util.inspect(root.BGDATA, false, null));
  const root = document.IMPORT;
  const records = [];
  const header = parseHeader(root.DEVICE[0]);

  const deviceId = `${header.modelName}:${header.serialNumber}`;
  theBuilder.setDefaults({ deviceId });

  if (cfg) {
    const currentSettings = theBuilder.makePumpSettings()
      .with_manufacturers(cfg.manufacturers)
      .with_serialNumber(header.serialNumber)
      .with_units({ bg: header.bgUnit, carbs: header.carbUnit })
      .done();
    records.push(currentSettings);
  }

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
