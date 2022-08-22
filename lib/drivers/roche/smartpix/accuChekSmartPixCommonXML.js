import sundial from 'sundial';
import _ from 'lodash';

const isBrowser = typeof window !== 'undefined';

// eslint-disable-next-line
export const log = isBrowser ? require('bows')('AccuChekSmartPixDriver') : console.log;

export const ALARM_TYPES = {
  W1: 'low_insulin',
  E1: 'no_insulin',
  W2: 'low_battery',
  E2: 'no_battery',
  E3: 'auto_off',
  E4: 'occlusion',
};
/*
Other alarms:
W3: Check time.
W4: Device old. (6y)
W5: Loan-time ending soon (in 30d).
W6: TBA cancelled.
W7: TBA ended.
W8: Bolus cancelled
W9: Loan-time ending soon.
W10: Bluetooth problem.
E5: Loan-time ended.
E6: Mechanic problem.
E7: Electronic problem.
E8: Power failure.
E9: Loan-time ended.
E10: Ampulla problem.
E11: Cathether not filled.
E12: Ongoing data transfer.
E13: Language error.
R1: Own reminder.
R2: Warranty expired. (4y)
*/

const DATE_FORMAT = /^(\d+)-(\d+)-(\d+)$/;
const TIME_FORMAT = /^(\d+):(\d+)$/;

export function parseDtTm(entry) {
  const dt = DATE_FORMAT.exec(entry.Dt);
  const tm = TIME_FORMAT.exec(entry.Tm);
  if (!dt || !tm) {
    throw new Error('Date or time format was not understood.');
  }

  return sundial.buildTimestamp({
    year: dt[1],
    month: dt[2],
    day: dt[3],
    hours: tm[1],
    minutes: tm[2],
    seconds: 0,
  });
}

export function makeDebug(state, result, original, related, reason) {
  if (state.DEBUG && result != null) {
    const payload = typeof (result.debug) === 'object' ? result.debug : {};
    payload.originalRow = original;
    if (related) {
      payload.relatedRow = related;
    }
    if (reason) {
      _.assign(payload, reason);
    }
    _.assign(result, { debug: payload });
  }
  return result;
}

export function newState(state) {
  if (state) {
    return {
      /** Last Run entry used to calculate time for suspension
       * between Stop and Run. */
      lastRunEntry: state.lastRunEntry,
      lastStopEntry: state.lastStopEntry,
      lastTBREndEntry: state.lastTBREndEntry,
      lastTBRStartEntry: state.lastTBRStartEntry,
      lastScheduledTBRChangeEntry: state.lastScheduledTBRChangeEntry,
      lastBasalEntry: state.lastBasalEntry,
    };
  }
  return {
    /** Last Run entry used to calculate time for suspension
     * between Stop and Run. */
    lastRunEntry: null,
    lastStopEntry: null,
    lastTBREndEntry: null,
    lastTBRStartEntry: null,
    lastScheduledTBRChangeEntry: null,
    lastBasalEntry: null,
  };
}
