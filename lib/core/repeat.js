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

// Calls an asynchronous function every `wait` milliseconds
// Stops when error occurs or returned `stop()` function is called
// If `timeout` (milliseconds) is set, will automatically stop when time expires
// Calls `done` if provided after stopping, with any `err` object that occured
module.exports = function(func, wait, timeout, done) {
  var stopped = false;
  var timeoutId;
  var noop = function() {};
  done = done || noop;
  var stop = function(err) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    stopped = true;
    done(err);
  };

  if (timeout) {
    if (timeout <= wait) {
      throw new Error('Repeat `timeout` must be smaller than `wait`');
    }
    timeoutId = setTimeout(function() {
      stop();
    }, timeout);
  }

  var go = function() {
    func(function(err) {
      if (err) {
        return stop(err);
      }

      setTimeout(function() {
        if (!stopped) {
          go();
        }
      }, wait);
    });
  };

  go();

  return stop;
};
