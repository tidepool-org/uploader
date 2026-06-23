/* global  __VERSION_SHA__ */
import Rollbar from 'rollbar';

let rollbar;

if (process.env.NODE_ENV === 'production') {

  rollbar = new Rollbar({
      accessToken: 'e73a71af17f7497eb606ef6278b190f3',
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

        // Every upload error is rethrown as `new Error(...)` at the same line in
        // makeUploadCb, and the filename rewrite above collapses all frames to one
        // path. That makes the stack-based fingerprint identical for every upload
        // failure, so Rollbar groups distinct errors (e.g. "no new data") together.
        // Fingerprint by the error code we already report so each failure mode is
        // its own group, with a stable title. Errors without a code (e.g. uncaught)
        // fall back to Rollbar's default grouping.
        var code = payload.custom && payload.custom.code;
        if (code) {
          payload.fingerprint = code;
          payload.title = code;
        }
      }
    }
  );
};

export default rollbar;
