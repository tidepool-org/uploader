/* global  __VERSION_SHA__ */

import Rollbar from 'rollbar/dist/rollbar.umd';

let rollbar = new Rollbar({
    accessToken: '1843589282464f4facd43f794c8201a8',
    captureUncaught: true,
    payload: {
        environment: 'electron_renderer',
        client: {
          javascript: {
            code_version: __VERSION_SHA__,
            guess_uncaught_frames: true
          }
        }
    },
    // to deal with URI's as local filesystem paths, we use the "many domain" transform:
    // https://rollbar.com/docs/source-maps/#using-source-maps-on-many-domains
    transform: function(payload) {
      var trace = payload.body.trace;
      if (trace && trace.frames) {
        for (var i = 0; i < trace.frames.length; i++) {
          var filename = trace.frames[i].filename;
          if (filename) {
            trace.frames[i].filename = 'http://dynamichost/dist/bundle.js';
          }
        }
      }
    }
  }
);

export default rollbar;
