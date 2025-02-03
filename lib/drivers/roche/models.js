/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2024, Tidepool Project
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

import _ from 'lodash';

const models = [
  { name: 'Aviva Connect', numbers: [483, 484, 497, 498, 499, 500, 502, 685] },
  { name: 'Performa Connect', numbers: [479, 501, 503, 765] },
  { name: 'Guide', numbers: [921, 922, 923, 925, 926, 929, 930, 932] },
  { name: 'Instant (single-button)', numbers: [958, 959, 960, 961, 963, 964, 965] },
  { name: 'Guide Me', numbers: [897, 898, 901, 902, 903, 904, 905] },
  { name: 'Instant (two-button)', numbers: [972, 973, 975, 976, 977, 978, 979, 980] },
  { name: 'Instant S (single-button)', numbers: [966, 967, 968, 969, 970, 971] },
  { name: 'ReliOn Platinum', numbers: [982] },
];

const getModelName = (number) => {
  // eslint-disable-next-line no-restricted-syntax
  for (const i in models) {
    if (models[i].numbers.indexOf(_.toInteger(number)) >= 0) {
      return models[i].name;
    }
  }
  return `Unknown model ${number}`;
};

export default getModelName;
