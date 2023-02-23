import sundial from 'sundial';
import _ from 'lodash';
import {
  ALARM_TYPES, makeDebug, parseDtTm,
} from './accuChekSmartPixCommonXML';
import parseBasal from './acspBasal';
import parseBolusInfo from './acspBolus';
import annotate from '../../../eventAnnotations';
import TZOUtil from '../../../TimezoneOffsetUtil';

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const log = isBrowser ? require('bows')('AccuChekSmartPixDriver') : console.log;

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

function parseIPData(ipdata, header, cfg) {
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

    finalStopEntry: null,
    setFinalStopEntry(v) { this.finalStopEntry = v; },

    lastTimeChangeEntry: null,
    setLastTimeChangeEntry(v) { this.lastTimeChangeEntry = v; },

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

  // get time change events
  _.forEach(_.keys(ipdata), (indexStr) => {
    const i = indexStr - 0;
    const row = ipdata[i];

    if (_.startsWith(row.$.remark, 'time / date set')) {
      state.setLastTimeChangeEntry(row);
    }

    if (row.$.remark === 'Stop') {
      state.setFinalStopEntry(row);
    }

    if (row.$.remark === 'time / date corrected') {
      if (state.lastTimeChangeEntry) {
        const fromDate = parseDtTm(row.$);
        if (fromDate.getFullYear() > 2015) {
          const toDate = parseDtTm(state.lastTimeChangeEntry.$);
          const timeChange = cfg.builder.makeDeviceEventTimeChange()
            .with_change({
              from: sundial.formatDeviceTime(fromDate),
              to: sundial.formatDeviceTime(toDate),
              agent: 'manual',
            })
            .with_deviceTime(sundial.formatDeviceTime(toDate))
            .set('jsDate', toDate)
            .set('index', i);
          entries.push(timeChange);
        }
        state.setLastTimeChangeEntry(null);
      } else {
        log('Missing time change event');
      }
    }
  });

  const mostRecent = sundial.applyTimezone(
    parseDtTm(state.finalStopEntry.$),
    cfg.timezone,
  ).toISOString();
  // eslint-disable-next-line no-param-reassign
  cfg.tzoUtil = new TZOUtil(cfg.timezone, mostRecent, entries);
  state.setFinalStopEntry(null);

  _.forEach(_.keys(ipdata), (indexStr) => {
    const i = indexStr - 0;
    const element = ipdata[i];
    state.nextEntry = ipdata[i + 1] || null;
    state.currentRowIndex = i;

    const type = element['#name'];
    let result = null;
    switch (type) {
      case 'BOLUS':
        result = parseBolusInfo(element, state, cfg.builder);
        break;
      case 'BASAL':
        result = parseBasal(element, state, cfg.builder);
        break;
      case 'EVENT':
        result = parseEvent(element, state, cfg.builder);
        break;
      default:
    }
    if (result !== null) {
      const time = parseDtTm(element.$);
      result = result
        .with_deviceTime(sundial.formatDeviceTime(time))
        .set('index', i);
      cfg.tzoUtil.fillInUTCInfo(result, time);
      delete result.index;
      entries.push(result.done());

      if (result.type === 'deviceEvent' && result.subType === 'status' && result.status === 'suspended') {
        const postbasal = cfg.builder.makeSuspendBasal()
          .with_deviceTime(result.deviceTime)
          .set('index', i)
          .with_duration(result.duration);
        cfg.tzoUtil.fillInUTCInfo(postbasal, time);
        delete postbasal.index;
        entries.push(postbasal.done());
      }
    }
  });

  // add final basal (always suspended before upload)
  const time = parseDtTm(state.finalStopEntry.$);
  const finalBasal = cfg.builder.makeSuspendBasal()
    .with_deviceTime(sundial.formatDeviceTime(time))
    .set('index', 0);
  cfg.tzoUtil.fillInUTCInfo(finalBasal, time);
  finalBasal.duration = 0;
  annotate.annotateEvent(finalBasal, 'basal/unknown-duration');
  delete finalBasal.index;
  entries.push(finalBasal.done());

  return entries;
}

/**
 * Parse pump data from parsed xml document.
 *
 * @param document {Object} Document parsed with `xml2js`.
 * @param context {{manufacturers: string, timezone: string}} Device info.
 * @param builder {objectBuilder?} Previous objectBuilder.
 * @returns {{metadata: Object, records: *[]}} Parsed data, ready for API.
 */
export default function parsePumpData(document, cfg) {
  const root = document.IMPORT;
  const records = [];
  const header = parseHeader(root.IP[0]);

  const deviceId = `Roche-${header.modelName.replace(/\s+/g, '')}-${header.serialNumber}`;
  cfg.builder.setDefaults({ deviceId });

  const time = parseDtTm(root.IP[0].$);

  const currentSettings = cfg.builder.makePumpSettings()
    .with_manufacturers(cfg.deviceInfo.manufacturers)
    .with_serialNumber(header.serialNumber)
    .with_deviceTime(sundial.formatDeviceTime(time))
    .with_time(sundial.applyTimezone(time, cfg.timezone).toISOString())
    .with_timezoneOffset(sundial.getOffsetFromZone(time, cfg.timezone))
    .with_conversionOffset(0)
    .with_units({ bg: 'mmol/L', carb: 'grams' })
    .with_basalSchedules(header.basalSchedules)
    .with_activeSchedule(header.activeProfile)
    .done();
  records.push(currentSettings);

  const stream = parseIPData(root.IPDATA[0].$$, header, cfg);

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
