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
  const count = bytes.getUint16(24);

  for (let i = 0; i < count; i++) {
    const obj = {};
    const objClass = bytes.getUint16(offset);
    obj.class = getKeyByValue(MDC_PART_OBJ, objClass);
    obj.handle = bytes.getUint16(offset + 2);
    obj.attributeCount = bytes.getUint16(offset + 4);
    const length = bytes.getUint16(offset + 6);

    offset += length + 8;

    if (type === objClass) {
      obj.bytes = new DataView(bytes.buffer.slice(offset - length, offset));
      return obj;
    }
  }

  return null;
}

export function getAttributeList(bytes) {
  let offset = 14;

  const obj = {};
  obj.attributeCount = bytes.getUint16(offset);
  const length = bytes.getUint16(offset + 2);
  offset += 4;
  obj.bytes = new DataView(bytes.buffer.slice(offset, offset + length));

  return obj;
}

export function getProductionSpecEntry(bytes, entry) {
  let offset = 0;
  const count = bytes.getUint16(offset);

  for (let i = 0; i < count; i++) {
    const type = PROD_SPEC_ENTRY[bytes.getUint16(offset + 4)];
    const length = bytes.getUint16(offset + 8);
    offset += length + 10;

    if (entry === type) {
      return new DataView(bytes.buffer.slice(offset - length, offset));
    }
  }

  return null;
}

export function getAttribute(obj, type) {
  let offset = 0;

  for (let i = 0; i < obj.attributeCount; i++) {
    const attributeId = obj.bytes.getUint16(offset);
    const length = obj.bytes.getUint16(offset + 2);

    offset += length + 4;

    if (type === attributeId) {
      return new DataView(obj.bytes.buffer.slice(offset - length, offset));
    }
  }

  return null;
}
