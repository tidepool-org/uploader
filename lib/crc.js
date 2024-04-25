/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
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

module.exports.A_INITIAL_REMAINDER = 0xFFFF;
module.exports.A_FINAL_XOR_VALUE = 0x0000;
module.exports.D_INITIAL_REMAINDER = 0x0000;
module.exports.D_FINAL_XOR_VALUE = 0x0000;
module.exports.CRC_TABLE = [
  0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50a5, 0x60c6, 0x70e7,
  0x8108, 0x9129, 0xa14a, 0xb16b, 0xc18c, 0xd1ad, 0xe1ce, 0xf1ef,
  0x1231, 0x0210, 0x3273, 0x2252, 0x52b5, 0x4294, 0x72f7, 0x62d6,
  0x9339, 0x8318, 0xb37b, 0xa35a, 0xd3bd, 0xc39c, 0xf3ff, 0xe3de,
  0x2462, 0x3443, 0x0420, 0x1401, 0x64e6, 0x74c7, 0x44a4, 0x5485,
  0xa56a, 0xb54b, 0x8528, 0x9509, 0xe5ee, 0xf5cf, 0xc5ac, 0xd58d,
  0x3653, 0x2672, 0x1611, 0x0630, 0x76d7, 0x66f6, 0x5695, 0x46b4,
  0xb75b, 0xa77a, 0x9719, 0x8738, 0xf7df, 0xe7fe, 0xd79d, 0xc7bc,
  0x48c4, 0x58e5, 0x6886, 0x78a7, 0x0840, 0x1861, 0x2802, 0x3823,
  0xc9cc, 0xd9ed, 0xe98e, 0xf9af, 0x8948, 0x9969, 0xa90a, 0xb92b,
  0x5af5, 0x4ad4, 0x7ab7, 0x6a96, 0x1a71, 0x0a50, 0x3a33, 0x2a12,
  0xdbfd, 0xcbdc, 0xfbbf, 0xeb9e, 0x9b79, 0x8b58, 0xbb3b, 0xab1a,
  0x6ca6, 0x7c87, 0x4ce4, 0x5cc5, 0x2c22, 0x3c03, 0x0c60, 0x1c41,
  0xedae, 0xfd8f, 0xcdec, 0xddcd, 0xad2a, 0xbd0b, 0x8d68, 0x9d49,
  0x7e97, 0x6eb6, 0x5ed5, 0x4ef4, 0x3e13, 0x2e32, 0x1e51, 0x0e70,
  0xff9f, 0xefbe, 0xdfdd, 0xcffc, 0xbf1b, 0xaf3a, 0x9f59, 0x8f78,
  0x9188, 0x81a9, 0xb1ca, 0xa1eb, 0xd10c, 0xc12d, 0xf14e, 0xe16f,
  0x1080, 0x00a1, 0x30c2, 0x20e3, 0x5004, 0x4025, 0x7046, 0x6067,
  0x83b9, 0x9398, 0xa3fb, 0xb3da, 0xc33d, 0xd31c, 0xe37f, 0xf35e,
  0x02b1, 0x1290, 0x22f3, 0x32d2, 0x4235, 0x5214, 0x6277, 0x7256,
  0xb5ea, 0xa5cb, 0x95a8, 0x8589, 0xf56e, 0xe54f, 0xd52c, 0xc50d,
  0x34e2, 0x24c3, 0x14a0, 0x0481, 0x7466, 0x6447, 0x5424, 0x4405,
  0xa7db, 0xb7fa, 0x8799, 0x97b8, 0xe75f, 0xf77e, 0xc71d, 0xd73c,
  0x26d3, 0x36f2, 0x0691, 0x16b0, 0x6657, 0x7676, 0x4615, 0x5634,
  0xd94c, 0xc96d, 0xf90e, 0xe92f, 0x99c8, 0x89e9, 0xb98a, 0xa9ab,
  0x5844, 0x4865, 0x7806, 0x6827, 0x18c0, 0x08e1, 0x3882, 0x28a3,
  0xcb7d, 0xdb5c, 0xeb3f, 0xfb1e, 0x8bf9, 0x9bd8, 0xabbb, 0xbb9a,
  0x4a75, 0x5a54, 0x6a37, 0x7a16, 0x0af1, 0x1ad0, 0x2ab3, 0x3a92,
  0xfd2e, 0xed0f, 0xdd6c, 0xcd4d, 0xbdaa, 0xad8b, 0x9de8, 0x8dc9,
  0x7c26, 0x6c07, 0x5c64, 0x4c45, 0x3ca2, 0x2c83, 0x1ce0, 0x0cc1,
  0xef1f, 0xff3e, 0xcf5d, 0xdf7c, 0xaf9b, 0xbfba, 0x8fd9, 0x9ff8,
  0x6e17, 0x7e36, 0x4e55, 0x5e74, 0x2e93, 0x3eb2, 0x0ed1, 0x1ef0
];

module.exports.CRC2_TABLE =
[
  0x0000,0x1189,0x2312,0x329B,0x4624,0x57AD,0x6536,0x74BF,
  0x8C48,0x9DC1,0xAF5A,0xBED3,0xCA6C,0xDBE5,0xE97E,0xF8F7,
  0x1081,0x0108,0x3393,0x221A,0x56A5,0x472C,0x75B7,0x643E,
  0x9CC9,0x8D40,0xBFDB,0xAE52,0xDAED,0xCB64,0xF9FF,0xE876,
  0x2102,0x308B,0x0210,0x1399,0x6726,0x76AF,0x4434,0x55BD,
  0xAD4A,0xBCC3,0x8E58,0x9FD1,0xEB6E,0xFAE7,0xC87C,0xD9F5,
  0x3183,0x200A,0x1291,0x0318,0x77A7,0x662E,0x54B5,0x453C,
  0xBDCB,0xAC42,0x9ED9,0x8F50,0xFBEF,0xEA66,0xD8FD,0xC974,
  0x4204,0x538D,0x6116,0x709F,0x0420,0x15A9,0x2732,0x36BB,
  0xCE4C,0xDFC5,0xED5E,0xFCD7,0x8868,0x99E1,0xAB7A,0xBAF3,
  0x5285,0x430C,0x7197,0x601E,0x14A1,0x0528,0x37B3,0x263A,
  0xDECD,0xCF44,0xFDDF,0xEC56,0x98E9,0x8960,0xBBFB,0xAA72,
  0x6306,0x728F,0x4014,0x519D,0x2522,0x34AB,0x0630,0x17B9,
  0xEF4E,0xFEC7,0xCC5C,0xDDD5,0xA96A,0xB8E3,0x8A78,0x9BF1,
  0x7387,0x620E,0x5095,0x411C,0x35A3,0x242A,0x16B1,0x0738,
  0xFFCF,0xEE46,0xDCDD,0xCD54,0xB9EB,0xA862,0x9AF9,0x8B70,
  0x8408,0x9581,0xA71A,0xB693,0xC22C,0xD3A5,0xE13E,0xF0B7,
  0x0840,0x19C9,0x2B52,0x3ADB,0x4E64,0x5FED,0x6D76,0x7CFF,
  0x9489,0x8500,0xB79B,0xA612,0xD2AD,0xC324,0xF1BF,0xE036,
  0x18C1,0x0948,0x3BD3,0x2A5A,0x5EE5,0x4F6C,0x7DF7,0x6C7E,
  0xA50A,0xB483,0x8618,0x9791,0xE32E,0xF2A7,0xC03C,0xD1B5,
  0x2942,0x38CB,0x0A50,0x1BD9,0x6F66,0x7EEF,0x4C74,0x5DFD,
  0xB58B,0xA402,0x9699,0x8710,0xF3AF,0xE226,0xD0BD,0xC134,
  0x39C3,0x284A,0x1AD1,0x0B58,0x7FE7,0x6E6E,0x5CF5,0x4D7C,
  0xC60C,0xD785,0xE51E,0xF497,0x8028,0x91A1,0xA33A,0xB2B3,
  0x4A44,0x5BCD,0x6956,0x78DF,0x0C60,0x1DE9,0x2F72,0x3EFB,
  0xD68D,0xC704,0xF59F,0xE416,0x90A9,0x8120,0xB3BB,0xA232,
  0x5AC5,0x4B4C,0x79D7,0x685E,0x1CE1,0x0D68,0x3FF3,0x2E7A,
  0xE70E,0xF687,0xC41C,0xD595,0xA12A,0xB0A3,0x8238,0x93B1,
  0x6B46,0x7ACF,0x4854,0x59DD,0x2D62,0x3CEB,0x0E70,0x1FF9,
  0xF78F,0xE606,0xD49D,0xC514,0xB1AB,0xA022,0x92B9,0x8330,
  0x7BC7,0x6A4E,0x58D5,0x495C,0x3DE3,0x2C6A,0x1EF1,0x0F78
];

/*********************************************************************
 * Function:    calcCRC()
 * Description: Compute the Zmodem CRC of a given array of bytes.
 * Notes:       The CRC table is well-known and dates back at least to the
 *              1980s where it was used in the Zmodem protocol.
 *              In Zmodem and many other implementations, the INITIAL_REMAINDER
 *              is 0, but other values exist even in this file (Asante).
 *              Be careful if you use any other implementation of CRC.
 * Inputs:      bytes - pointer to ArrayBuffer to have crc performed.
 *              size - Number of bytes in dataRec. Do not include the CRC field.
 *              initial_remainder - starting value for CRC calculation
 *              final_xor - value to XOR before returning the result
 * Returns:     The CRC of the buffer.
 *********************************************************************/
module.exports.calcCRC = function (bytes, size, initial_remainder, final_xor) {
  var crc16;
  var i, j;

  crc16 = initial_remainder;
  // Divide the buffer by the polynomial, a byte at a time.
  for (i = 0; i < size; i++) {
    crc16 = this.CRC_TABLE[(bytes[i] ^ (crc16 >> 8)) & 0xFF] ^ ((crc16 << 8) & 0xFFFF);
  }
  // The final remainder is the CRC.
  return (crc16 ^ final_xor);
};

/*********************************************************************
 * Function:    calcCRC_A()
 * Description: Compute the CRC of a given array of bytes; this is
 *              compatible with the C++ code that we were given by Asante
 *              and with the example code given by J&J.
 * Inputs:      bytes - ArrayBuffer to have crc performed.
 *              size - Number of bytes in dataRec. Do not include the CRC field.
 * Returns:     The CRC of the buffer.
 *********************************************************************/
module.exports.calcCRC_A = function (bytes, size) {
  return this.calcCRC(bytes, size,
                               this.A_INITIAL_REMAINDER,
                               this.A_FINAL_XOR_VALUE);
};

/*********************************************************************
 * Function:    calcCRC_D()
 * Description: Compute the Dexcom CRC of a given array of bytes.
 * Inputs:      bytes - ArrayBuffer to have crc performed.
 *              size - Number of bytes in dataRec. Do not include the CRC field.
 * Returns:     The CRC of the buffer.
 *********************************************************************/
module.exports.calcCRC_D = function (bytes, size) {
  return this.calcCRC(bytes, size,
                               this.D_INITIAL_REMAINDER,
                               this.D_FINAL_XOR_VALUE);
};

/*********************************************************************
 * Function:    calcCRC_I()
 * Description: Compute the Intuity Medical CRC of a given array of bytes.
 * Inputs:      bytes - ArrayBuffer to have crc performed.
 *              size - Number of bytes in dataRec. Do not include the CRC field,
 *                     STX or ETX
 * Returns:     The CRC of the buffer.
 *********************************************************************/
module.exports.calcCRC_I = function (bytes, size) {
  var crc16;
  var i;

  crc16 = 0xFFFF;
  // Divide the buffer by the polynomial, a byte at a time.
  for (i = 0; i < size; i++) {
    crc16 = this.CRC2_TABLE[(crc16 ^ bytes[i]) & 0xFF] ^ ((crc16 >> 8) & 0xFF);
  }
  // The final remainder is the CRC.
  return (crc16 ^ 0xFFFF);
};

module.exports.testCRC_A = function (s) {
  var buf = new ArrayBuffer(s.length);
  var bytes = new Uint8Array(buf);
  for (var i = 0; i < s.length; ++i) {
    bytes[i] = s.charCodeAt(i);
  }
  console.log(bytes);
  var acrc = this.calcCRC_A(bytes, s.length);
  console.log('Asante CRC (decimal) = ', acrc);
  return acrc;
};

module.exports.testCRC_D = function (s) {
  var buf = new ArrayBuffer(s.length);
  var bytes = new Uint8Array(buf);
  for (var i = 0; i < s.length; ++i) {
    bytes[i] = s.charCodeAt(i);
  }
  console.log(bytes);
  var dcrc = this.calcCRC_D(bytes, s.length);
  console.log('Dexcom CRC (decimal) = ', dcrc);
  return dcrc;
};

module.exports.testCRC_I = function (s) {
  var buf = new ArrayBuffer(s.length);
  var bytes = new Uint8Array(buf);
  for (var i = 0; i < s.length; ++i) {
    bytes[i] = s.charCodeAt(i);
  }
  console.log(bytes);
  var icrc = this.calcCRC_I(bytes, s.length);
  console.log('Intuity CRC (decimal) = ', icrc);
  return icrc;
};


module.exports.validateCRC = function () {
  // this line of code is straight from Asante's and J&J's documentation as a test case
  if (this.testCRC_A('\x02\x06\x06\x03') != 0x41CD) {
    console.log('CRC_A logic is NOT CORRECT!!!');
    return false;
  }
  // this is backsolved from Dexcom code that works to mimic the test case above.
  if (this.testCRC_D('\x02\x06\x06\x03') != 50445) {
    console.log('CRC_D logic is NOT CORRECT!!!');
    return false;
  }
  // this is based on an error result from Intuity's POGO meter
  if (this.testCRC_I('!?C') != 0xDADE) {
    console.log('CRC_I logic is NOT CORRECT!!!');
    return false;
  }
  return true;
};

// Fletcher-16 checksum algorithm
var fletcher16 = function(buf) {
  var sum1 = 0xff, sum2 = 0xff;
  var i = 0;
  var len = buf.length;

  while (len) {
    var tlen = len > 20 ? 20 : len;
    len -= tlen;
    do {
      sum2 += sum1 += buf[i++];
    } while (--tlen);
    sum1 = (sum1 & 0xff) + (sum1 >> 8);
    sum2 = (sum2 & 0xff) + (sum2 >> 8);
  }
  sum1 = (sum1 & 0xff) + (sum1 >> 8);
  sum2 = (sum2 & 0xff) + (sum2 >> 8);
  return sum2 << 8 | sum1;
};

/* To initialize the CRC-8 algorithm, we provide a polynomial to generate
 * the lookup table. For example, for Metronic's Bayer Contour Next Link
 * implementation, the polynomial is 0x9b.
 */
module.exports.crc8_init = function(polynomial)
{
  var table = [];

  // generate lookup table
  for ( var i = 0; i < 256; ++i ) {
    var curr = i;
    for ( var j = 0; j < 8; ++j ) {
      if ((curr & 0x80) !== 0) {
        curr = ((curr << 1) ^ polynomial) % 256;
      } else {
        curr = (curr << 1) % 256;
      }
    }
    table[i] = curr ;
  }

  this.table = table;
};

module.exports.crc8_checksum = function(bytes) {
  var checksum = 0;

  for (var i = 0; i < bytes.length; i++ ) {
    checksum = this.table[(checksum ^ bytes[i]) % 256];
  };

  return checksum;
};
