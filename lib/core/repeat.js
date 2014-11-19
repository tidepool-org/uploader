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

// Call a function every `wait` milliseconds
// Stop when returned `stop()` function is called
// If `timeout` (milliseconds) is set, will automatically stop then
// and call `onTimeout()` if provided
module.exports = function(func, wait, timeout, onTimeout) {
  var stopped = false;
  var stop = function() {
    stopped = true;
  };
  var noop = function() {};
  onTimeout = onTimeout || noop;
  var timeoutId;

  if (timeout) {
    if (timeout <= wait) {
      throw new Error('Repeat `timeout` must be smaller than `wait`');
    }
    setTimeout(function() {
      stop();
      onTimeout();
    }, timeout);
  }

  var go = function() {
    func();
    timeoutId = setTimeout(function() {
      if (stopped) {
        clearTimeout(timeoutId);
        return;
      }
      go();
    }, wait);
  };

  go();

  return stop;
};
