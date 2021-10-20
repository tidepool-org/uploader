// == BSD2 LICENSE ==
// Copyright (c) 2014, Tidepool Project
//
// This program is free software; you can redistribute it and/or modify it under
// the terms of the associated License, which is identical to the BSD 2-Clause
// License as published by the Open Source Initiative at opensource.org.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the License for more details.
//
// You should have received a copy of the License along with this program; if
// not, you can obtain one from Tidepool Project at tidepool.org.
// == BSD2 LICENSE ==

import _ from 'lodash';

/**
 * Create our the store we will be using
 *
 * @param {Object}  options
 * @param {Object}  options.ourStore the storage system we are using
 */
module.exports = (options) => ({
  init: (data, cb) => {
    const result = _.reduce(data, (res, defaultValue, key) => {
      let value = options.ourStore.getItem(key);
      if (value == null) {
        value = defaultValue;
      }
      res[key] = value;
      return res;
    }, {});
    cb(result);
  },
  getItem: options.ourStore.getItem.bind(options.ourStore),
  setItem: options.ourStore.setItem.bind(options.ourStore),
  removeItem: options.ourStore.removeItem.bind(options.ourStore),
});
