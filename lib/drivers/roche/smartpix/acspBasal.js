import _ from 'lodash';
import sundial from 'sundial';
import {
  ALARM_TYPES, log, makeDebug, parseDtTm,
} from './accuChekSmartPixCommonXML';

const TBR_REMARK_PATTERN = /^dur (\d+):(\d+) h$/;
const TBR_PERCENT_PATTERN = /^\s*(\d+)%$/;

function mostRecentBasalAlteringEntry(state) {
  const entries = [
    state.lastBasalEntry,
    state.lastStopEntry,
    state.lastTBRStartEntry,
    state.lastScheduledTBRChangeEntry,
  ];
  const times = _.map(entries, (e) => {
    if (e != null) {
      return parseDtTm(e.$).valueOf();
    }
    return null;
  });

  let minValue = Number.MAX_VALUE;
  let minIndex = -1;
  _.forEach(times, (e, index) => {
    if (e != null && e < minValue) {
      minValue = e;
      minIndex = index;
    }
  });

  if (minIndex >= 0) {
    return entries[minIndex];
  }
  return null;
}

function makeBasalEntry(state, row, builder) {
  const closestEntry = mostRecentBasalAlteringEntry(state);
  if (closestEntry == null) {
    log(state);
    log(row);
    throw new Error('Missing closest entry for basal duration calculation');
  }

  const time = parseDtTm(row.$);
  const closestTimestamp = parseDtTm(closestEntry.$);
  const duration = sundial.dateDifference(closestTimestamp, time, 'minutes');
  const result = builder.makeScheduledBasal()
    .with_rate(Number.parseFloat(row.$.cbrf))
    .with_duration(duration * sundial.MIN_TO_MSEC)
    .with_scheduleName(row.$.profile);
  return makeDebug(state, result, row, closestEntry);
}

export default function parseBasal(row, state, builder) {
  const { remark } = row.$;
  const time = parseDtTm(row.$);
  let result = null;

  if (remark) {
    switch (remark) {
      case 'Run':
        if (state.lastRunEntry != null) {
          log(state.lastRunEntry);
          log(row);
          throw new Error('Double Run?');
        }
        result = makeBasalEntry(state, row, builder);
        state.setLastRunEntry(row);
        state.setLastStopEntry(null);
        break;

      case 'Stop': {
        // XXX: Stop basal event might contain TBRinc or TBRdec attribute,
        // which is probably useless since in that case this row was
        // preceded by "TBR End (cancelled)" basal event.
        if (state.lastRunEntry == null) {
          // Data stream contains a "Stop" event in few first lines, as
          // device needs to be stopped for data transfer. We don't
          // have Run entry to pair it with, and so we can't calculate
          // required duration for the suspension. Ignore this event...
          state.setLastStopEntry(row);
          break;
        }

        let suspendReason;
        let suspendPayload = null;
        let reason = null;
        const { nextEntry } = state;

        if (nextEntry != null && nextEntry['#name'] === 'EVENT') {
          const nextTime = parseDtTm(nextEntry.$);
          const nextShort = nextEntry.$.shortinfo;

          if (nextTime.valueOf() === time.valueOf()
            && _.startsWith(nextShort, 'E') && nextShort.length <= 3) {
            reason = nextEntry;
            suspendReason = 'automatic';
            const alarmType = ALARM_TYPES[nextEntry.$.type] || 'other';
            suspendPayload = {
              suspended: {
                cause: 'alarm',
                alarm_type: alarmType,
                alarm_id: nextShort,
                alarm_name: nextEntry.$.description,
              },
            };
          } else {
            suspendReason = 'manual';
          }
        } else {
          suspendReason = 'manual';
        }

        const runTimestamp = parseDtTm(state.lastRunEntry.$);
        const stopLengthMinutes = sundial.dateDifference(runTimestamp, time, 'minutes');
        result = builder.makeDeviceEventSuspendResume()
          .with_duration(stopLengthMinutes * sundial.MIN_TO_MSEC)
          .with_reason({
            // Accu-Check pumps do not automatically resume.
            resumed: 'manual',
            suspended: suspendReason,
          });
        if (suspendPayload) {
          result = result.with_payload(suspendPayload);
        }
        result = makeDebug(state, result, row, state.lastRunEntry,
          { reason });

        // Processing done. Clear until next Run.
        state.setLastRunEntry(null);
        state.setLastStopEntry(row);

        break;
      }

      case 'power up':
        break;

      case 'power down':
        break;

      case 'TBR End':
      case 'TBR End (cancelled)':
        if (state.lastTBREndEntry != null) {
          log(state.lastTBREndEntry);
          log(row);
          throw new Error('Unexpected TBR End record');
        }
        result = makeBasalEntry(state, row, builder);
        state.setLastTBREndEntry(row);
        break;

      default:
        if (_.startsWith(remark, 'dur') && (row.$.TBRinc || row.$.TBRdec)) {
          // TBR Start entry.
          if (state.lastTBREndEntry == null) {
            log(row);
            throw new Error('Missing TBR End record');
          }
          const tbr = (row.$.TBRinc || row.$.TBRdec);

          const previousEntry = (state.lastScheduledTBRChangeEntry || state.lastTBREndEntry);
          const endTimestamp = parseDtTm(previousEntry.$);
          const currentRateTbrLengthMinutes = sundial.dateDifference(endTimestamp, time, 'minutes');
          const tbrTotalLength = sundial.dateDifference(parseDtTm(state.lastTBREndEntry.$), time, 'minutes');
          const remarkLengthMatch = TBR_REMARK_PATTERN.exec(remark);
          const remarkLength = Number.parseInt(remarkLengthMatch[1], 10) * 60
            + Number.parseInt(remarkLengthMatch[2], 10);
          if (remarkLength !== tbrTotalLength) {
            log(`Differing TBR remark ${remarkLength} and actual times ${tbrTotalLength}.`);
          }

          const rate = Number.parseFloat(row.$.cbrf);
          const percents = Number.parseInt(TBR_PERCENT_PATTERN.exec(tbr)[1], 10);

          result = builder.makeTempBasal()
            .with_percent(percents / 100.0)
            .with_rate(rate)
            .with_duration(currentRateTbrLengthMinutes * sundial.MIN_TO_MSEC);
          result = makeDebug(state, result, row, state.lastTBREndEntry);

          state.setLastTBRStartEntry(row);
          state.setLastTBREndEntry(null);
          state.setLastScheduledTBRChangeEntry(null);
        }
        break;
    }
  } else if (row.$.TBRinc || row.$.TBRdec) {
    // Incomplete TBR entry due profile basal rate change.
    const tbrStart = state.getNextTBREntry();
    const previousEntry = (state.lastScheduledTBRChangeEntry || state.lastTBREndEntry);

    const tbr = (row.$.TBRinc || row.$.TBRdec);
    const endTimestamp = parseDtTm(previousEntry.$);
    const tbrLengthMinutes = sundial.dateDifference(endTimestamp, time, 'minutes');
    const rate = Number.parseFloat(row.$.cbrf);
    // XXX: percents might be bogus since SmartPix 3.01 might mess it up.
    const rowPercents = Number.parseInt(TBR_PERCENT_PATTERN.exec(tbr)[1], 10);

    const realPercents = Number.parseInt(TBR_PERCENT_PATTERN.exec(
      tbrStart.$.TBRinc || tbrStart.$.TBRdec,
    )[1], 10);
    if (rowPercents !== realPercents) {
      log(`Differing TBR percents ${rowPercents} with start percents ${realPercents}.`);
    }

    result = builder.makeTempBasal()
      .with_percent(realPercents / 100.0)
      .with_rate(rate)
      .with_duration(tbrLengthMinutes * sundial.MIN_TO_MSEC);
    result = makeDebug(state, result, row, previousEntry,
      { start: tbrStart });

    state.setLastScheduledTBRChangeEntry(row);
  } else if (row.$.cbrf && row.$.profile) {
    result = makeBasalEntry(state, row, builder);
    state.setLastBasalEntry(row);
  }
  return result;
}
