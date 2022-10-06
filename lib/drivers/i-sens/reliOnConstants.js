/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2021, Tidepool Project
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

export const COMMANDS = {
  READ: [0x52, 0x7c], // R|
  WRITE: [0x57, 0x7c], // W|
  DATE: [0x44, 0x7c], // D|
  TIME: [0x54, 0x7c], // T|
  DATA: [0x4e, 0x7c], // N|
  NROFRECORDS: [0x4d, 0x7c], // M|
};

export const FLAGS = {
  HI: { value: 0x01, name: 'High measurement result' },
  LO: { value: 0x02, name: 'Low measurement result' },
  CONTROL_SOLUTION: { value: 0x04, name: 'Control Solution Test' },
};
