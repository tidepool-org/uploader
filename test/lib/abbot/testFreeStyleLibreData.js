/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2016, Tidepool Project
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 *
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

/* global beforeEach, describe, it */

import {expect} from 'salinity';

import builder from '../../../lib/objectBuilder';
import annotate from '../../../lib/eventAnnotations';

import {FreeStyleLibreData} from '../../../lib/drivers/abbott/freeStyleLibreData';
import {
  GLUCOSE_HI,
  GLUCOSE_LO
} from '../../../lib/drivers/abbott/freeStyleLibreConstants';

const factoryConfigJson = `
  {
    "dataLength": 237,
    "opCode": 81,
    "packetLength": 240,
    "data": {"type":"Buffer","data":[1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,70,114,101,101,83,116,121,108,101,32,76,105,98,114,101,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,10,3,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,0,0,1,1,1,2,0,0,246,1,38,0,60,0,60,0,0,0,240,0,70,0,0,60,1,0,128,213,224,80,0,0,60,0,0,0,0,0,87,23,0,0,100,11,0,0,125,0,203,0,224,46,0,10,45,1,0,0,128,175,27,0,180,0,30,0,10,6,5,10,35,35,35,40,35,40,35,50,50,35,35,35,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,79,130,30,27]}
  }
`;

function deserialize(jsonString) {
  return JSON.parse(jsonString, (k, v) => {
    if (v !== null && typeof v === 'object' && 'type' in v &&
      v.type === 'Buffer' && 'data' in v && Array.isArray(v.data)) {
      // re-create Buffer objects for data fields of aapPackets
      return new Buffer(v.data);
    }
    return v;
  });
}

describe('freeStyleLibreData.js', () => {
  const cfg = {
    builder: builder(),
    timezone: 'Europe/Berlin'
  };

  describe('non-static', () => {
    let fsLibreData;

    beforeEach(function(){
      fsLibreData = new FreeStyleLibreData(cfg);
    });

    describe('process AAP packets', () => {

      it('correctly restores 32bit records numbers', () => {
        const historicalRecordJson = `
          {
            "dataLength": 21,
            "opCode": 49,
            "packetLength": 23,
            "data": {"type":"Buffer","data":[6,164,144,12,128,83,91,16,5,220,205,255,255,75,0,224,31,0,0,69,248]}
          }
        `;
        const data = {
          aapPackets: [
            deserialize(factoryConfigJson),
            deserialize(historicalRecordJson)
          ]
        };

        // potentially problematic 32bit record numbers
        const recordNumbers = [0, 1, 0xfffe, 0xffff, 0x10000, 0x10001, 0xffffffff];

        recordNumbers.forEach(recordNumber => {
          // use lower 16bits to replace 16bit record number in historical record
          data.aapPackets[1].data[1] = recordNumber & 0xff;
          data.aapPackets[1].data[2] = (recordNumber >> 8) & 0xff;

          // use recordNumber + 1 as current DB record number (which will be used for next record written)
          const postRecords = fsLibreData.processAapPackets(data.aapPackets, recordNumber + 1);

          // check if valid record was returned and contains correct 32bit record number
          expect(postRecords.length).equals(1);
          expect(postRecords[0].index).equals(recordNumber);
        });
      });

    });

  });

  describe('static', () => {

    describe('validate annotations', () => {
      it('annotates only out-of-range BG values', () => {
        const inputData = [
          [GLUCOSE_LO, true],
          [GLUCOSE_HI, true],
          [GLUCOSE_LO - 1, true],
          [GLUCOSE_HI + 1, true],
          [GLUCOSE_LO + 1, false],
          [GLUCOSE_HI - 1, false],
        ];
        inputData.forEach(([value, expectedResult]) => {
          const cbg = cfg.builder.makeCBG()
            .with_value(value)
            .with_units('mg/dL');

          FreeStyleLibreData.addOutOfRangeAnnotation(cbg, GLUCOSE_LO, GLUCOSE_HI, 1, 'bg');

          const isAnnotated = annotate.isAnnotated(cbg, 'bg/out-of-range');

          expect(isAnnotated).equals(expectedResult);
        });
      });
    });

  });
});
