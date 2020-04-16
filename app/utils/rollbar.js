/* global  __VERSION_SHA__ */
import Rollbar from 'rollbar/dist/rollbar.umd';

let rollbar;

if (process.env.NODE_ENV === 'production') {

  rollbar = new Rollbar({
      accessToken: '1843589282464f4facd43f794c8201a8',
      captureUncaught: true,
      enabled: process.env.NODE_ENV === 'production',
      payload: {
          environment: 'electron_renderer',
          client: {
            javascript: {
              code_version: __VERSION_SHA__,
              guess_uncaught_frames: true
            }
          },
          server: {
            root: 'webpack:///./'
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
              trace.frames[i].filename = 'http://dynamichost/dist/renderer.prod.js';
            }
          }
        }
      }
    }
  );
};

export default rollbar;
