import sundial from 'sundial';
import { log, makeDebug } from './accuChekSmartPixCommonXML';

const BOLUS_EXT_REMARK = /^\s?(\d+):(\d+) h$/;
const BOLUS_MUL_REMARK = /^\s?(\d+\.\d+) \/ (\d+\.\d+)\s+(\d+):(\d+) h$/;
const BOLUS_EPSILON = 0.00001;

export default function parseBolusInfo(row, state, builder) {
  const { type } = row.$;

  if (row.$.Tm === '' && row.$.remark.indexOf('Total') >= 0) {
    // Ignore daily totals.
    return null;
  }

  let result = null;
  switch (type) {
    case 'Scr':
    case 'Std': {
      const amount = Number.parseFloat(row.$.amount);

      if (amount > BOLUS_EPSILON) {
        result = builder.makeNormalBolus()
          .with_normal(amount);
      } else {
        // We do not have expected size for the bolus and zero-bolus
        // without expected size is disallowed. We could perhaps store
        // previous bolus and check if it is close enough to this one
        // and set its value to expected value, but that's heuristics.
        log('Dropping zero-sized bolus:');
        log(row);
      }
      break;
    }

    case 'Ext': {
      const remark = BOLUS_EXT_REMARK.exec(row.$.remark);
      const amount = Number.parseFloat(row.$.amount);
      const durationMinutes = Number.parseInt(remark[1], 10) * 60 + Number.parseInt(remark[2], 10);

      if (amount > BOLUS_EPSILON) {
        result = builder.makeSquareBolus()
          .with_extended(amount)
          .with_duration(durationMinutes * sundial.MIN_TO_MSEC);
      } else {
        // Not allowed, see above.
        log('Dropping zero-sized bolus:');
        log(row);
      }
      break;
    }

    case 'Mul': {
      const remark = BOLUS_MUL_REMARK.exec(row.$.remark);
      const normalAmount = Number.parseFloat(remark[1]);
      const extendedAmount = Number.parseFloat(remark[2]);
      const extendedDuration = Number.parseInt(remark[3], 10) * 60 + Number.parseInt(remark[4], 10);

      if (normalAmount > BOLUS_EPSILON || extendedAmount > BOLUS_EPSILON) {
        result = builder.makeDualBolus()
          .with_normal(normalAmount)
          .with_extended(extendedAmount)
          .with_duration(extendedDuration * sundial.MIN_TO_MSEC);
      } else {
        // Not allowed, see above.
        log('Dropping zero-sized bolus:');
        log(row);
      }
      break;
    }

    default:
      log(`Unexpected bolus type: ${type}`);
      break;
  }

  if (result) {
    result = makeDebug(state, result, row);
  }
  return result;
}
