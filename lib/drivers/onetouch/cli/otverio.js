#!/usr/bin/env babel-node
/* eslint-disable no-console */

import { OneTouchVerio, PARAMETER_TYPE, QUERY_TYPE} from '../oneTouchVerio';

const intro = 'OTVerio CLI:';

const driver = new OneTouchVerio();
const err1 = driver.openDevice();
if (err1) {
  console.log(intro, err1);
  process.exit(1);
}

driver.scsiInquiry((err2) => {
  if (err2) {
    console.log(intro, 'ERROR:', err2);
    process.exit(1);
  }

  const queryType = QUERY_TYPE.serialNumber;
  driver.retrieveQueryData(queryType, (err3, data1) => {
    if (err3) {
      process.exit(1);
    }
    console.log(intro, queryType, data1[queryType]);

    const parameterType = PARAMETER_TYPE.displayUnit;
    driver.retrieveParameterData(parameterType, (err4, data2) => {
      if (err4) {
        process.exit(1);
      }
      console.log(intro, parameterType, data2[parameterType]);

      driver.retrieveRecordCount((err5, data3) => {
        if (err5) {
          process.exit(1);
        }

        driver.retrieveRecords(data3.recordCount, (err6, data4) => {
          console.log(intro, 'records:', data4);
          process.exit();
        });
      });
    });
  });
});
