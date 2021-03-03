import sundial from 'sundial';
import _ from 'lodash';
import objectBuilder from '../../../objectBuilder';
import {
  ALARM_TYPES, makeDebug, parseDtTm,
} from './accuChekSmartPixCommonXML';
import parseBasal from './acspBasal';
import parseBolusInfo from './acspBolus';

const IU_FORMAT = /^(\d+\.\d+)\s*IU$/;

const PUMP_NAMES = {
  Combo: 'Spirit / Combo',
};

function parseEvent(row, state, builder) {
  const type = row.$.shortinfo;
  const { description } = row.$;

  let result = null;
  const alarmType = ALARM_TYPES[type];
  if (alarmType) {
    result = builder.makeDeviceEventAlarm()
      .with_alarmType(alarmType)
      .with_payload({
        alarm_id: type,
        alarm_name: description,
      });
  } else if (type) {
    if (description === 'prime infusion set') {
      const amountStr = IU_FORMAT.exec(type)[1];
      result = builder.makeDeviceEventPrime()
        .with_primeTarget('tubing')
        .with_volume(Number.parseFloat(amountStr));
    } else {
      // Unhandled event type.
      result = builder.makeDeviceEventAlarm()
        .with_alarmType('other')
        .with_payload({
          alarm_id: type,
          alarm_name: description,
        });
    }
  } else if (description === 'cartridge changed') {
    result = builder.makeDeviceEventReservoirChange();
  }
  if (result) {
    result = makeDebug(state, result, row);
  }
  return result;
}

function parseHeader(pumpInfo) {
  const profiles = {};
  const srcProfiles = pumpInfo.IPPROFILE;
  const activeProfile = pumpInfo.$.ActiveProf;

  _.forEach(srcProfiles, (profile) => {
    // Slot list is constant-length. Compress entries using same value to a single entry.
    const profileData = [];
    let lastIU = null;

    _.forEach(profile.IPTIMESLOT, (entry) => {
      const currentIU = entry.$.IU;
      if (currentIU !== lastIU) {
        profileData.push({
          // Number is ending-hour. Convert it to start-hour (and then to milliseconds).
          start: (Number.parseInt(entry.$.Number, 10) - 1) * 60 * sundial.MIN_TO_MSEC,
          // IU per hour.
          // XXX: This value might be bogus as at least SmartPix
          // version 3.01 truncates the value to 1 decimal.
          rate: Number.parseFloat(currentIU),
        });
        lastIU = currentIU;
      }
    });
    if (profileData.length > 0) {
      // TODO: Ensure starts are ordered?
      profiles[profile.$.Name] = profileData;
    }
  });

  return {
    activeProfile,
    basalSchedules: profiles,
    serialNumber: _.trim(pumpInfo.$.SN),
    modelName: _.trim(pumpInfo.$.Name),
  };
}

function parseIPData(ipdata, builder) {
  const state = {
    /** Last Run entry used to calculate time for suspension
     * between Stop and Run. */
    lastRunEntry: null,
    setLastRunEntry(v) { this.lastRunEntry = v; },

    lastStopEntry: null,
    setLastStopEntry(v) { this.lastStopEntry = v; },

    lastTBREndEntry: null,
    setLastTBREndEntry(v) { this.lastTBREndEntry = v; },

    lastTBRStartEntry: null,
    setLastTBRStartEntry(v) { this.lastTBRStartEntry = v; },

    lastScheduledTBRChangeEntry: null,
    setLastScheduledTBRChangeEntry(v) { this.lastScheduledTBRChangeEntry = v; },

    lastBasalEntry: null,
    setLastBasalEntry(v) { this.lastBasalEntry = v; },

    /** Peek-ahead to next row of data. */
    nextEntry: null,
    /** Attach debug-key to result objects? */
    DEBUG: false,

    currentRowIndex: null,
    getNextTBREntry() {
      for (let i = state.currentRowIndex + 1; i < ipdata.length; i++) {
        const row = ipdata[i];
        if (row.$.TBRinc || row.$.TBRdec) {
          return row;
        }
      }
      throw new Error('Missing next TBR entry.');
    },
  };

  const entries = [];
  _.forEach(_.keys(ipdata), (indexStr) => {
    const i = indexStr - 0;
    const element = ipdata[i];
    state.nextEntry = ipdata[i + 1] || null;
    state.currentRowIndex = i;

    const type = element['#name'];
    let result = null;
    switch (type) {
      case 'BOLUS':
        result = parseBolusInfo(element, state, builder);
        break;
      case 'BASAL':
        result = parseBasal(element, state, builder);
        break;
      case 'EVENT':
        result = parseEvent(element, state, builder);
        break;
      default:
    }
    if (result !== null) {
      const time = parseDtTm(element.$);
      result = result
        .with_deviceTime(sundial.formatDeviceTime(time))
        .with_time(sundial.applyTimezone(time, 'Europe/Helsinki')) // FIXME: TZ and conversion
        .with_timezoneOffset(120) // FIXME: TZ offset
        .with_clockDriftOffset(0)
        .with_conversionOffset(0);
      entries.push(result.done());
    }
  });
  return entries;
}

/**
 * Parse pump data from parsed xml document.
 *
 * @param document {Object} Document parsed with `xml2js`.
 * @param cfg {{manufacturers: string}?} Device info.
 * @param builder {objectBuilder?} Previous objectBuilder.
 * @returns {{metadata: Object, records: *[]}} Parsed data, ready for API.
 */
export function parsePumpData(document, cfg, builder) {
  const theBuilder = builder || objectBuilder();

  // log(util.inspect(root.IPDATA, false, null));
  const root = document.IMPORT;
  const records = [];
  const header = parseHeader(root.IP[0]);

  const deviceId = `${header.modelName}:${header.serialNumber}`;
  theBuilder.setDefaults({ deviceId });

  if (cfg) {
    const currentSettings = theBuilder.makePumpSettings()
      .with_manufacturers(cfg.manufacturers)
      .with_serialNumber(header.serialNumber)
      // TODO: We really don't know. This is a pump, not a bg meter!
      .with_units({ bg: 'mmol/L', carbs: 'grams' })
      .with_basalSchedules(header.basalSchedules)
      .with_activeSchedule(header.activeProfile)
      .done();
    records.push(currentSettings);
  }

  const stream = parseIPData(root.IPDATA[0].$$, theBuilder);

  // log(JSON.stringify(header, null, 2));
  // log(JSON.stringify(stream, null, 2));
  // log(util.inspect(basal, false, null));
  return {
    metadata: {
      modelName: header.modelName,
      model: PUMP_NAMES[header.modelName] || header.modelName,
      serialNumber: header.serialNumber,
      tags: ['insulin-pump'],
      deviceId,
    },
    records: records.concat(stream),
  };
}
