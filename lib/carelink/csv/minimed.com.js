var parsing = require('../parsing.js');

var RV = 'Raw-Values';

module.exports = {
  pumpTypesToRead: {
    BGCapturedOnPump: {
      RAW_TYPE: 'BGCapturedOnPump',
      RAW_VALUES: {
        AMOUNT: parsing.asNumber([RV, 'AMOUNT']),
        ACTION_REQUESTOR: parsing.extract([RV, 'ACTION_REQUESTOR'])
      }
    }
  },
  cgmTypesToRead: {

  }
};