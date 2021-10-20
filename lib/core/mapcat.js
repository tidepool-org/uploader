/**
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
*/

const _ = require('lodash');

// mapcat([1, 5], function(x) { return [x, x+1]; });
// -> [1, 2, 5, 6]
module.exports = (coll, fn) => _.reduce(coll, (acc, item) => {
  const fnItem = fn(item);
  if (fnItem && fnItem.length) {
    return acc.concat(fnItem);
  }
  return acc;
}, []);
