/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2019, Tidepool Project
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

<<<<<<< HEAD
export function cRC8(data) {
  const crc8Table = [
=======
export const APDU_TYPE = {
  ASSOCIATION_REQUEST: 0xE200,
  ASSOCIATION_RESPONSE: 0xE300,
  ASSOCIATION_RELEASE_REQUEST: 0xE400,
  ASSOCIATION_RELEASE_RESPONSE: 0xE500,
  ASSOCIATION_ABORT: 0xE600,
  PRESENTATION_APDU: 0xE700,
};

export const EVENT_TYPE = {
  MDC_NOTI_CONFIG: 0x0D1C,
  MDC_NOTI_SEGMENT_DATA: 0x0D21,
};

export const ACTION_TYPE = {
  MDC_ACT_SEG_GET_INFO: 0x0C0D,
  MDC_ACT_SEG_GET_ID_LIST: 0x0C1E,
  MDC_ACT_SEG_TRIG_XFER: 0x0C1C,
  MDC_ACT_SEG_SET_TIME: 0x0C17,
};

export const DATA_ADPU = {
  INVOKE_GET: 0x0103,
  INVOKE_CONFIRMED_ACTION: 0x0107,
  RESPONSE_CONFIRMED_EVENT_REPORT: 0x0201,
  RESPONSE_GET: 0x0203,
  RESPONSE_CONFIRMED_ACTION: 0x0207,
};

export const DATA_RESPONSE = {
  0: 'Transfer successful',
  1: 'No such segment',
  2: 'Try again later',
  3: 'Segment is empty',
  512: 'Failed to retrieve segment',
};

export const MDC_PART_OBJ = {
  MDC_MOC_VMO_METRIC: 4,
  MDC_MOC_VMO_METRIC_ENUM: 5,
  MDC_MOC_VMO_METRIC_NU: 6,
  MDC_MOC_VMO_METRIC_SA_RT: 9,
  MDC_MOC_SCAN: 16,
  MDC_MOC_SCAN_CFG: 17,
  MDC_MOC_SCAN_CFG_EPI: 18,
  MDC_MOC_SCAN_CFG_PERI: 19,
  MDC_MOC_VMS_MDS_SIMP: 37,
  MDC_MOC_VMO_PMSTORE: 61,
  MDC_MOC_PM_SEGMENT: 62,
  MDC_ATTR_CONFIRM_MODE: 2323,
  MDC_ATTR_CONFIRM_TIMEOUT: 2324,
  MDC_ATTR_TRANSPORT_TIMEOUT: 2694,
  MDC_ATTR_ID_HANDLE: 2337,
  MDC_ATTR_ID_INSTNO: 2338,
  MDC_ATTR_ID_LABEL_STRING: 2343,
  MDC_ATTR_ID_MODEL: 2344,
  MDC_ATTR_ID_PHYSIO: 2347,
  MDC_ATTR_ID_PROD_SPECN: 2349,
  MDC_ATTR_ID_TYPE: 2351,
  MDC_ATTR_METRIC_STORE_CAPAC_CNT: 2369,
  MDC_ATTR_METRIC_STORE_SAMPLE_ALG: 2371,
  MDC_ATTR_METRIC_STORE_USAGE_CNT: 2372,
  MDC_ATTR_MSMT_STAT: 2375,
  MDC_ATTR_NU_ACCUR_MSMT: 2378,
  MDC_ATTR_NU_CMPD_VAL_OBS: 2379,
  MDC_ATTR_NU_VAL_OBS: 2384,
  MDC_ATTR_NUM_SEG: 2385,
  MDC_ATTR_OP_STAT: 2387,
  MDC_ATTR_POWER_STAT: 2389,
  MDC_ATTR_SA_SPECN: 2413,
  MDC_ATTR_SCALE_SPECN_I16: 2415,
  MDC_ATTR_SCALE_SPECN_I32: 2416,
  MDC_ATTR_SCALE_SPECN_I8: 2417,
  MDC_ATTR_SCAN_REP_PD: 2421,
  MDC_ATTR_SEG_USAGE_CNT: 2427,
  MDC_ATTR_SYS_ID: 2436,
  MDC_ATTR_SYS_TYPE: 2438,
  MDC_ATTR_TIME_ABS: 2439,
  MDC_ATTR_TIME_BATT_REMAIN: 2440,
  MDC_ATTR_TIME_END_SEG: 2442,
  MDC_ATTR_TIME_PD_SAMP: 2445,
  MDC_ATTR_TIME_REL: 2447,
  MDC_ATTR_TIME_STAMP_ABS: 2448,
  MDC_ATTR_TIME_STAMP_REL: 2449,
  MDC_ATTR_TIME_START_SEG: 2450,
  MDC_ATTR_TX_WIND: 2453,
  MDC_ATTR_UNIT_CODE: 2454,
  MDC_ATTR_UNIT_LABEL_STRING: 2457,
  MDC_ATTR_VAL_BATT_CHARGE: 2460,
  MDC_ATTR_VAL_ENUM_OBS: 2462,
  MDC_ATTR_TIME_REL_HI_RES: 2536,
  MDC_ATTR_TIME_STAMP_REL_HI_RES: 2537,
  MDC_ATTR_DEV_CONFIG_ID: 2628,
  MDC_ATTR_MDS_TIME_INFO: 2629,
  MDC_ATTR_METRIC_SPEC_SMALL: 2630,
  MDC_ATTR_SOURCE_HANDLE_REF: 2631,
  MDC_ATTR_SIMP_SA_OBS_VAL: 2632,
  MDC_ATTR_ENUM_OBS_VAL_SIMP_OID: 2633,
  MDC_ATTR_ENUM_OBS_VAL_SIMP_STR: 2634,
  MDC_REG_CERT_DATA_LIST: 2635,
  MDC_ATTR_NU_VAL_OBS_BASIC: 2636,
  MDC_ATTR_PM_STORE_CAPAB: 2637,
  MDC_ATTR_PM_SEG_MAP: 2638,
  MDC_ATTR_PM_SEG_PERSON_ID: 2639,
  MDC_ATTR_SEG_STATS: 2640,
  MDC_ATTR_SEG_FIXED_DATA: 2641,
  MDC_ATTR_SCAN_HANDLE_ATTR_VAL_MAP: 2643,
  MDC_ATTR_SCAN_REP_PD_MIN: 2644,
  MDC_ATTR_ATTRIBUTE_VAL_MAP: 2645,
  MDC_ATTR_NU_VAL_OBS_SIMP: 2646,
  MDC_ATTR_PM_STORE_LABEL_STRING: 2647,
  MDC_ATTR_PM_SEG_LABEL_STRING: 2648,
  MDC_ATTR_TIME_PD_MSMT_ACTIVE: 2649,
  MDC_ATTR_SYS_TYPE_SPEC_LIST: 2650,
  MDC_ATTR_METRIC_ID_PART: 2655,
  MDC_ATTR_ENUM_OBS_VAL_PART: 2656,
  MDC_ATTR_SUPPLEMENTAL_TYPES: 2657,
  MDC_ATTR_TIME_ABS_ADJUST: 2658,
  MDC_ATTR_CLEAR_TIMEOUT: 2659,
  MDC_ATTR_TRANSFER_TIMEOUT: 2660,
  MDC_ATTR_ENUM_OBS_VAL_SIMP_BIT_STR: 2661,
  MDC_ATTR_ENUM_OBS_VAL_BASIC_BIT_STR: 2662,
  MDC_ATTR_METRIC_STRUCT_SMALL: 2675,
  MDC_ATTR_NU_CMPD_VAL_OBS_SIMP: 2676,
  MDC_ATTR_NU_CMPD_VAL_OBS_BASIC: 2677,
  MDC_ATTR_ID_PHYSIO_LIST: 2678,
  MDC_ATTR_SCAN_HANDLE_LIST: 2679,
  MDC_ATTR_TIME_BO: 2689,
  MDC_ATTR_TIME_STAMP_BO: 2690,
  MDC_ATTR_TIME_START_SEG_BO: 2691,
  MDC_ATTR_TIME_END_SEG_BO: 2692,
};

const PROD_SPEC_ENTRY = [
  'unspecified',
  'serial-number',
  'part-number',
  'hw-revision',
  'sw-revision',
  'fw-revision',
  'protocol-revision',
  'prod-spec-gmdn',
];

export function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}

export function getObject(bytes, type) {
  let offset = 28;
  const count = bytes.readUInt16BE(24);

  for (let i = 0; i < count; i++) {
    const obj = {};
    const objClass = bytes.readUInt16BE(offset);
    obj.class = getKeyByValue(MDC_PART_OBJ, objClass);
    obj.handle = bytes.readUInt16BE(offset + 2);
    obj.attributeCount = bytes.readUInt16BE(offset + 4);
    const length = bytes.readUInt16BE(offset + 6);

    offset += length + 8;

    if (type === objClass) {
      obj.bytes = bytes.slice(offset - length, offset);
      return obj;
    }
  }

  return null;
}

export function getAttributeList(bytes) {
  let offset = 14;

  const obj = {};
  obj.attributeCount = bytes.readUInt16BE(offset);
  const length = bytes.readUInt16BE(offset + 2);
  offset += 4;
  obj.bytes = bytes.slice(offset, offset + length);

  return obj;
}

export function getProductionSpecEntry(bytes, entry) {
  let offset = 0;
  const count = bytes.readUInt16BE(offset);

  for (let i = 0; i < count; i++) {
    const type = PROD_SPEC_ENTRY[bytes.readUInt16BE(offset + 4)];
    const length = bytes.readUInt16BE(offset + 8);
    offset += length + 10;

    if (entry === type) {
      return bytes.slice(offset - length, offset);
    }
  }

  return null;
}

export function getAttribute(obj, type) {
  let offset = 0;

  for (let i = 0; i < obj.attributeCount; i++) {
    const attributeId = obj.bytes.readUInt16BE(offset);
    const length = obj.bytes.readUInt16BE(offset + 2);

    offset += length + 4;

    if (type === attributeId) {
      return obj.bytes.slice(offset - length, offset);
    }
  }

  return null;
}


// Weitai 
export function CRC8(data) {
  var _crc8Table = [
>>>>>>> add-weitai-device
    0x00, 0x5e, 0xbc, 0xe2, 0x61, 0x3f, 0xdd, 0x83,
    0xc2, 0x9c, 0x7e, 0x20, 0xa3, 0xfd, 0x1f, 0x41,
    0x9d, 0xc3, 0x21, 0x7f, 0xfc, 0xa2, 0x40, 0x1e,
    0x5f, 0x01, 0xe3, 0xbd, 0x3e, 0x60, 0x82, 0xdc,
    0x23, 0x7d, 0x9f, 0xc1, 0x42, 0x1c, 0xfe, 0xa0,
    0xe1, 0xbf, 0x5d, 0x03, 0x80, 0xde, 0x3c, 0x62,
    0xbe, 0xe0, 0x02, 0x5c, 0xdf, 0x81, 0x63, 0x3d,
    0x7c, 0x22, 0xc0, 0x9e, 0x1d, 0x43, 0xa1, 0xff,
    0x46, 0x18, 0xfa, 0xa4, 0x27, 0x79, 0x9b, 0xc5,
    0x84, 0xda, 0x38, 0x66, 0xe5, 0xbb, 0x59, 0x07,
    0xdb, 0x85, 0x67, 0x39, 0xba, 0xe4, 0x06, 0x58,
    0x19, 0x47, 0xa5, 0xfb, 0x78, 0x26, 0xc4, 0x9a,
    0x65, 0x3b, 0xd9, 0x87, 0x04, 0x5a, 0xb8, 0xe6,
    0xa7, 0xf9, 0x1b, 0x45, 0xc6, 0x98, 0x7a, 0x24,
    0xf8, 0xa6, 0x44, 0x1a, 0x99, 0xc7, 0x25, 0x7b,
    0x3a, 0x64, 0x86, 0xd8, 0x5b, 0x05, 0xe7, 0xb9,
    0x8c, 0xd2, 0x30, 0x6e, 0xed, 0xb3, 0x51, 0x0f,
    0x4e, 0x10, 0xf2, 0xac, 0x2f, 0x71, 0x93, 0xcd,
    0x11, 0x4f, 0xad, 0xf3, 0x70, 0x2e, 0xcc, 0x92,
    0xd3, 0x8d, 0x6f, 0x31, 0xb2, 0xec, 0x0e, 0x50,
    0xaf, 0xf1, 0x13, 0x4d, 0xce, 0x90, 0x72, 0x2c,
    0x6d, 0x33, 0xd1, 0x8f, 0x0c, 0x52, 0xb0, 0xee,
    0x32, 0x6c, 0x8e, 0xd0, 0x53, 0x0d, 0xef, 0xb1,
    0xf0, 0xae, 0x4c, 0x12, 0x91, 0xcf, 0x2d, 0x73,
    0xca, 0x94, 0x76, 0x28, 0xab, 0xf5, 0x17, 0x49,
    0x08, 0x56, 0xb4, 0xea, 0x69, 0x37, 0xd5, 0x8b,
    0x57, 0x09, 0xeb, 0xb5, 0x36, 0x68, 0x8a, 0xd4,
    0x95, 0xcb, 0x29, 0x77, 0xf4, 0xaa, 0x48, 0x16,
    0xe9, 0xb7, 0x55, 0x0b, 0x88, 0xd6, 0x34, 0x6a,
    0x2b, 0x75, 0x97, 0xc9, 0x4a, 0x14, 0xf6, 0xa8,
    0x74, 0x2a, 0xc8, 0x96, 0x15, 0x4b, 0xa9, 0xf7,
<<<<<<< HEAD
    0xb6, 0xe8, 0x0a, 0x54, 0xd7, 0x89, 0x6b, 0x35,
  ];

  const bytes = new Uint8Array(data);
  let len = bytes.length;
  let checksum = 0x00;
  let i = 0;

  while (len) {
    len -= 1;
    checksum = crc8Table[checksum ^ bytes[i]];
    i += 1;
=======
    0xb6, 0xe8, 0x0a, 0x54, 0xd7, 0x89, 0x6b, 0x35
  ];

  let bytes = new Uint8Array(data);
  var len = bytes.length;
  var checksum = 0x00;
  var i = 0;

  while (len--) {
    checksum = _crc8Table[checksum ^ bytes[i]];
    i++;
>>>>>>> add-weitai-device
  }

  return checksum;
}

<<<<<<< HEAD
export function concatArrayBuffer(buffer1, buffer2) {
  const u8Array1 = new Uint8Array(buffer1);
  const u8Array2 = new Uint8Array(buffer2);

  const length = u8Array1.length + u8Array2.length;
  const buffer = new ArrayBuffer(length);
  const u8Array = new Uint8Array(buffer);
  for (let i = 0; i < u8Array1.length; i++) {
    u8Array[i] = u8Array1[i];
  }
  for (let i = 0; i < u8Array2.length; i++) {
    u8Array[i + u8Array1.length] = u8Array2[i];
  }

  return buffer;
}

export function packFrame(buffer) {
  const u8aBuffer = new Uint8Array(buffer);

  let newBuffer = new ArrayBuffer(0);
  for (let i = 0; i < u8aBuffer.length; i++) {
    const byte = u8aBuffer[i];
    if (byte === 0x2F || byte === 0x2B) {
      newBuffer = concatArrayBuffer(newBuffer, new Uint8Array([0x2F]).buffer);
    }
    newBuffer = concatArrayBuffer(newBuffer, new Uint8Array([byte]).buffer);
  }

  newBuffer = concatArrayBuffer(new Uint8Array([0x2B, 0x2B]).buffer, newBuffer);
  newBuffer = concatArrayBuffer(newBuffer, new Uint8Array([0x2B, 0x2B]).buffer);
=======
export function packFrame(buffer) {
  var u8a_buffer = new Uint8Array(buffer);

  var newBuffer = new ArrayBuffer(0);
  for (let i = 0; i < u8a_buffer.length; i++) {
    const byte = u8a_buffer[i];
    if (byte == 0x2F || byte == 0x2B) {
      newBuffer = concat_ArrayBuffer(newBuffer, new Uint8Array([0x2F]).buffer);
    }
    newBuffer = concat_ArrayBuffer(newBuffer, new Uint8Array([byte]).buffer);
  }

  newBuffer = concat_ArrayBuffer(new Uint8Array([0x2B, 0x2B]).buffer, newBuffer);
  newBuffer = concat_ArrayBuffer(newBuffer, new Uint8Array([0x2B, 0x2B]).buffer);
>>>>>>> add-weitai-device

  return newBuffer;
}

export function unpackFrame(buffer) {
<<<<<<< HEAD
  const u8aBuffer = new Uint8Array(buffer.slice(2, buffer.byteLength - 2));

  let newBuffer = new ArrayBuffer(0);
  for (let i = 0; i < u8aBuffer.length; i++) {
    const byte = u8aBuffer[i];
    if (byte === 0x2F) {
      if (i + 1 >= u8aBuffer.length) {
        //  不符合规则,最后一个2F不能单独出现
        return new ArrayBuffer(0);
      }

      const nextByte = u8aBuffer[i + 1];
      if (nextByte !== 0x2F && nextByte !== 0x2B) {
        //  不符合规则
        return new ArrayBuffer(0);
      }
      newBuffer = concatArrayBuffer(newBuffer, new Uint8Array([nextByte]).buffer);
      i += 1; //  NextByte已处理，直接跳过
    } else {
      newBuffer = concatArrayBuffer(newBuffer, new Uint8Array([byte]).buffer);
=======
  var u8a_buffer = new Uint8Array(buffer.slice(2, buffer.byteLength - 2));

  var newBuffer = new ArrayBuffer(0);
  for (let i = 0; i < u8a_buffer.length; i++) {
    const byte = u8a_buffer[i];
    if (byte == 0x2F) {
      if (i + 1 >= u8a_buffer.length) {
        //不符合规则,最后一个2F不能单独出现
        return new ArrayBuffer(0);
      }

      const nextByte = u8a_buffer[i + 1];
      if (nextByte != 0x2F && nextByte != 0x2B) {
        //不符合规则
        return new ArrayBuffer(0);
      }
      newBuffer = concat_ArrayBuffer(newBuffer, new Uint8Array([nextByte]).buffer);
      i++; //NextByte已处理，直接跳过
    } else {
      newBuffer = concat_ArrayBuffer(newBuffer, new Uint8Array([byte]).buffer);
>>>>>>> add-weitai-device
    }
  }

  return newBuffer;
}

<<<<<<< HEAD
export function uintFromArrayBuffer(orginBuffer, littleEndian) {
  let buffer = orginBuffer;
  if (Object.prototype.toString.call(orginBuffer) === '[object Uint8Array]') {
    const tmp = new Uint8Array(orginBuffer);
    buffer = tmp.buffer;
  }
  // const u8p = new Uint8Array();
  // u8p.buffer
=======
export function concat_ArrayBuffer(buffer1, buffer2) {
  let u8Array1 = new Uint8Array(buffer1);
  let u8Array2 = new Uint8Array(buffer2);

  var length = u8Array1.length + u8Array2.length;
  var buffer = new ArrayBuffer(length);
  var u8Array = new Uint8Array(buffer);
  for (var i = 0; i < u8Array1.length; i++) {
    u8Array[i] = u8Array1[i];
  }
  for (var i = 0; i < u8Array2.length; i++) {
    u8Array[i + u8Array1.length] = u8Array2[i];
  }

  return buffer;
}

/**
 * 
 * @param {ArrayBuffer} buffer 待转化array
 * @param {boolean} littleEndian 是否为小端
 */
export function uintFromArrayBuffer(buffer, littleEndian) {
  if (Object.prototype.toString.call(buffer) == '[object Uint8Array]') {
    let tmp = new Uint8Array(buffer);
    buffer = tmp.buffer;
  }

  let u8p = new Uint8Array();
  u8p.buffer;
>>>>>>> add-weitai-device

  if (buffer.byteLength > 4) {
    return 0;
  }
<<<<<<< HEAD
  const dv = new DataView(buffer);
  if (buffer.byteLength === 4) {
    return dv.getUint32(0, littleEndian);
  }
  if (buffer.byteLength === 2) {
    return dv.getUint16(0, littleEndian);
  }
  if (buffer.byteLength === 1) {
    return dv.getUint8(0);
  }
  return 0;
}

=======
  let dv = new DataView(buffer);
  if (buffer.byteLength == 4) {
    return dv.getUint32(0, littleEndian);
  }
  if (buffer.byteLength == 2) {
    return dv.getUint16(0, littleEndian);
  }
  if (buffer.byteLength == 1) {
    return dv.getUint8(0);
  }
}

/**
 * 
 * @param {number} i 待转化uint值
 * @param {number} byteLength 输出array长度
 * @param {boolean} littleEndian 是否为小端
 */
>>>>>>> add-weitai-device
export function arrayBufferFromUint(i, byteLength, littleEndian) {
  if (byteLength > 4) {
    return new ArrayBuffer(0);
  }
<<<<<<< HEAD
  const buffer = new ArrayBuffer(byteLength);
  const dv = new DataView(buffer);

  if (byteLength === 4) {
    dv.setUint32(0, i, littleEndian);
  }
  if (byteLength === 2) {
    dv.setUint16(0, i, littleEndian);
  }
  if (byteLength === 1) {
=======
  let buffer = new ArrayBuffer(byteLength);
  let dv = new DataView(buffer);

  if (byteLength == 4) {
    dv.setUint32(0, i, littleEndian);
  }
  if (byteLength == 2) {
    dv.setUint16(0, i, littleEndian);
  }
  if (byteLength == 1) {
>>>>>>> add-weitai-device
    dv.setUint8(0, i);
  }
  return buffer;
}

<<<<<<< HEAD
// export function formatString(inString, length, isLeft) {
export function formatString(inString) {
  // let count = length - inString.length;

  const outString = inString;
  // while (count > 0) {
  //   if (isLeft) {
  //     outString = outString;
  //   } else {
  //     outString = outString;
  //   }
  //   count -= 1;
  // }
  return outString;
}
=======
/**
 * 
 * @param {String} inString 输入字符串
 * @param {number} length 输出长度
 * @param {boolean} isLeft 是否为左补齐
 */
export function formatString(inString, length, isLeft) {
  let count = length - inString.length;
  
  let outString = inString;
  while (count > 0) {
      if (isLeft) {
        outString = outString;
      } else {
        outString = outString;
      }
      count --;
  }
   
  return outString;
}
>>>>>>> add-weitai-device
