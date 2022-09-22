/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2020, Tidepool Project
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

export const ASCII_CONTROL = {
  ACK: 0x06,
  CR: 0x0D,
  ENQ: 0x05,
  EOT: 0x04,
  ETB: 0x17,
  ETX: 0x03,
  LF: 0x0A,
  NAK: 0x15,
  STX: 0x02,
  CAN: 0x18,
};

export const MODELS = {
  Bayer6200: 'Contour Next Link', // mg/dL
  Contour6200: 'Contour Next Link', // mg/dL
  Bayer6210: 'Contour Next Link 2.4', // mg/dL
  Contour6210: 'Contour Next Link 2.4', // mg/dL
  Bayer6300: 'Contour Next Link', // mmol/L
  Contour6300: 'Contour Next Link', // mmol/L
  Bayer7350: 'Contour Next', // mg/dL & mmol/L
  Contour7350: 'Contour Next', // mg/dL & mmol/L
  Bayer7390: 'Contour USB', // mg/dL
  Contour7390: 'Contour USB', // mg/dL
  Bayer7410: 'Contour Next USB', // mg/dL & mmol/L
  Contour7410: 'Contour Next USB', // mg/dL & mmol/L
  Contour7800: 'Contour Next One', // mg/dL & mmol/L
  Bayer7150: 'Contour',
  Contour7150: 'Contour',
  Bayer7160: 'Contour Next EZ',
  Contour7160: 'Contour Next EZ',
  Bayer7220: 'Contour',
  Contour7220: 'Contour',
  Contour7600: 'Contour Plus',
  Contour7900: 'Contour Next',
  Contour7950: 'Contour Plus Blue',
};

export const COMMANDS = {
  READ: [0x52, 0x7c], // R|
  WRITE: [0x57, 0x7c], // W|
  DATE: [0x44, 0x7c], // D|
  TIME: [0x54, 0x7c], // T|
};

export const METHODS = {
  B: 'whole blood',
  P: 'plasma',
  C: 'capillary',
};

export const MARKS = {
  B: 'pre-meal',
  A: 'post-meal',
  D: 'logbook',
};
