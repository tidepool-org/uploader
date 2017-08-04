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

import {FreeStyleLibreProtocol} from '../../../lib/drivers/abbott/freeStyleLibreProtocol.js';

describe('freeStyleLibreProtocol.js', () => {
  const cfg = {};

  describe('non-static', () => {
    let protocol;

    beforeEach(function(){
      protocol = new FreeStyleLibreProtocol(cfg);
    });

    describe('parse text responses', () => {

      it('does parse and return valid text responses', () => {
        const inputData = [
          ['DB Record Number = 226988\r\nCKSM:00000765\r\nCMD OK\r\n', 'DB Record Number = 226988\r\n'],
          ['2.1.2\r\nCKSM:00000108\r\nCMD OK\r\n', '2.1.2\r\n']
        ];
        inputData.forEach(([data, expectedResult]) => {
            const result = protocol.parseTextResponse(data);
            expect(result).deep.equals(expectedResult);
          }
        );
      });


      it('does not accept invalid text responses', () => {
        const inputData = [
          ['DB Record Number = 226988\r\nCKSM:00000765\r\nCMD Fail!\r\n', Error],
          ['2.1.2\r\nCKSM:00000111\r\nCMD OK\r\n', Error],
          ['2.1.2\r\nCKSM:108\r\nCMD OK\r\n', Error]
        ];
        inputData.forEach(([data, expectedResult]) => {
            const result = protocol.parseTextResponse(data);
            expect(result).instanceof(expectedResult);
          }
        );
      });
    });

  });

  describe('static', () => {

    describe('validate checksum', () => {
      it('does accept valid checksums', () => {
        const inputData = [
          ['', 0],
          ['\x01\x02\x03\x04\x05', 15]
        ];
        inputData.forEach(([data, checksum]) => {
            const result = FreeStyleLibreProtocol.validateTextChecksum(data, checksum);
            expect(result).deep.equals(true);
          }
        );
      });

      it('does decline invalid checksums', () => {
        const inputData = [
          ['', 10],
          ['\x01\x02\x03\x04\x05', 0],
          ['', null],
          ['', undefined],
          ['', ''],
        ];
        inputData.forEach(([data, checksum]) => {
            const result = FreeStyleLibreProtocol.validateTextChecksum(data, checksum);
            expect(result).deep.equals(false);
          }
        );
      });
    });

  });
});
