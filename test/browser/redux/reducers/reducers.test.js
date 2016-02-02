/*
 * == BSD2 LICENSE ==
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
 * == BSD2 LICENSE ==
 */

/*eslint-env mocha*/

import _ from 'lodash';

import * as actionTypes from '../../../../lib/redux/constants/actionTypes';
import { pages, steps } from '../../../../lib/redux/constants/otherConstants';
import * as reducers from '../../../../lib/redux/reducers/reducers';

import devices from '../../../../lib/redux/reducers/devices';

import { UnsupportedError } from '../../../../lib/redux/utils/errors';

let pwd = require('../../fixtures/pwd.json');
let nonpwd = require('../../fixtures/nonpwd.json');

describe('reducers', () => {
  describe('devices', () => {
    function filterDevicesFn(os) {
      return function(device) {
        if (device.enabled[os] === true) {
          return true;
        }
        return false;
      };
    }
    it('should return the initial state', () => {
      expect(reducers.devices(undefined, {})).to.deep.equal(devices);
    });

    it('should handle HIDE_UNAVAILABLE_DEVICES [mac]', () => {
      let actualResult = reducers.devices(undefined, {
        type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
        payload: {os: 'mac'}
      });
      let expectedResult = _.pick(devices, filterDevicesFn('mac'));
      expect(actualResult).to.deep.equal(expectedResult);
      // because we do currently have devices unavailable on Mac
      expect(Object.keys(actualResult).length).to.be.lessThan(Object.keys(devices).length);
      // test to be sure not *mutating* state object but rather returning new!
      let prevState = devices;
      let resultState = reducers.devices(prevState, {
        type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
        payload: {os: 'mac'}
      });
      expect(prevState === resultState).to.be.false;
    });

    it('should handle HIDE_UNAVAILABLE_DEVICES [win]', () => {
      let actualResult = reducers.devices(undefined, {
        type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
        payload: {os: 'win'}
      });
      let expectedResult = _.pick(devices, filterDevicesFn('win'));
      expect(actualResult).to.deep.equal(expectedResult);
      // because nothing currently is unavailable on Windows
      expect(Object.keys(actualResult).length).to.equal(Object.keys(devices).length);
      // test to be sure not *mutating* state object but rather returning new!
      let prevState = devices;
      let resultState = reducers.devices(prevState, {
        type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
        payload: {os: 'win'}
      });
      expect(prevState === resultState).to.be.false;
    });
  });

  describe('dropdown', () => {
    it('should return the initial state', () => {
      expect(reducers.dropdown(undefined, {})).to.be.false;
    });

    it('should handle TOGGLE_DROPDOWN', () => {
      expect(reducers.dropdown(undefined, {
        type: actionTypes.TOGGLE_DROPDOWN,
        payload: {isVisible: true}
      })).to.be.true;
      expect(reducers.dropdown(undefined, {
        type: actionTypes.TOGGLE_DROPDOWN,
        payload: {isVisible: false}
      })).to.be.false;
    });

    it('should handle LOGOUT_REQUEST', () => {
      expect(reducers.dropdown(undefined, {
        type: actionTypes.LOGOUT_REQUEST
      })).to.be.false;
      expect(reducers.dropdown(true, {
        type: actionTypes.LOGOUT_REQUEST
      })).to.be.false;
      expect(reducers.dropdown(false, {
        type: actionTypes.LOGOUT_REQUEST
      })).to.be.false;
    });
  });

  describe('os', () => {
    it('should return the initial state', () => {
      expect(reducers.os(undefined, {})).to.be.null;
    });

    it('should handle SET_OS', () => {
      expect(reducers.os(undefined, {
        type: actionTypes.SET_OS,
        payload: {os: 'test'}
      })).to.equal('test');
    });
  });

  describe('page', () => {
    it('should return the initial state', () => {
      expect(reducers.page(undefined, {})).to.equal(pages.LOADING);
    });

    it('should handle SET_PAGE', () => {
      expect(reducers.page(undefined, {
        type: actionTypes.SET_PAGE,
        payload: {page: 'main'}
      })).to.equal('main');
    });
  });

  describe('unsupported', () => {
    it('should return the initial state', () => {
      expect(reducers.unsupported(undefined, {})).to.be.true;
    });

    it('should handle VERSION_CHECK_FAILURE [API error]', () => {
      const err = new Error('API error!');
      expect(reducers.unsupported(undefined, {
        type: actionTypes.VERSION_CHECK_FAILURE,
        error: true,
        payload: err
      })).to.deep.equal(err);
    });

    it('should handle VERSION_CHECK_FAILURE [uploader version doesn\'t meet minimum]', () => {
      const currentVersion = '0.99.0', requiredVersion = '0.100.0';
      const err = new UnsupportedError(currentVersion, requiredVersion);
      expect(reducers.unsupported(undefined, {
        type: actionTypes.VERSION_CHECK_FAILURE,
        error: true,
        payload: err
      })).to.be.true;
    });

    it('should handle VERSION_CHECK_SUCCESS', () => {
      expect(reducers.unsupported(undefined, {
        type: actionTypes.VERSION_CHECK_SUCCESS
      })).to.be.false;
    });
  });

  describe('uploads', () => {
    it('should return the initial state', () => {
      expect(reducers.uploads(undefined, {})).to.deep.equal({uploadInProgress: false});
    });

    it('should handle CHOOSING_FILE', () => {
      const userId = 'a1b2c3', deviceKey = 'a_cgm';
      let initialState = {
        a1b2c3: {
          a_cgm: {history: []}
        }
      };
      let resultState = {
        a1b2c3: {
          a_cgm: {history: []}
        },
        uploadInProgress: {
          pathToUpload: [userId, deviceKey]
        }
      };
      let finalState = reducers.uploads(initialState, {
        type: actionTypes.CHOOSING_FILE,
        payload: { userId, deviceKey }
      });
      expect(finalState).to.deep.equal(resultState);
      // test to be sure not *mutating* state object but rather returning new!
      expect(initialState === finalState).to.be.false;
    });

    it('should handle CARELINK_FETCH_FAILURE', () => {
      const userId = 'a1b2c3', deviceKey = 'carelink';
      const time = '2016-01-01T12:05:00.123Z';
      const uploadInProgress = {
        pathToUpload: [userId, deviceKey],
        progress: {
          step: steps.carelinkFetch,
          percentage: 0
        }
      };
      let initialState = {
        uploadInProgress: uploadInProgress,
        a1b2c3: {
          carelink: {
            history: [{start: time}],
            isFetching: true
          },
          a_pump: {
            history: [{foo: 'bar'}],
            disabled: true
          }
        }
      };
      let err = new Error('Upload error');
      err.utc = time;
      let resultState = {
        uploadInProgress: uploadInProgress,
        a1b2c3: {
          carelink: {
            history: [{start: time}],
            isFetching: false
          },
          a_pump: {
            history: [{foo: 'bar'}],
            disabled: true
          }
        }
      };
      let finalState = reducers.uploads(initialState, {
        type: actionTypes.CARELINK_FETCH_FAILURE,
        error: true,
        payload: err
      });
      expect(finalState).to.deep.equal(resultState);
      // we're not changing this, so we expect it to stay the same
      expect(initialState.a1b2c3.carelink.history === finalState.a1b2c3.carelink.history).to.be.true;
      expect(initialState.a1b2c3.carelink.history[0] === finalState.a1b2c3.carelink.history[0]).to.be.true;
      expect(initialState.a1b2c3.a_pump === finalState.a1b2c3.a_pump).to.be.true;
      // tests to be sure not *mutating* state object but rather returning new!
      expect(initialState === finalState).to.be.false;
      expect(initialState.a1b2c3 === finalState.a1b2c3).to.be.false;
      expect(initialState.a1b2c3.carelink === finalState.a1b2c3.carelink).to.be.false;
    });

    it('should handle CARELINK_FETCH_REQUEST', () => {
      const userId = 'a1b2c3', deviceKey = 'carelink';
      let initialState = {
        a1b2c3: {
          carelink: {history: []}
        },
        uploadInProgress: {progress: {step: 'start', percentage: 0}}
      };
      let resultState = {
        a1b2c3: {
          carelink: {history: [], isFetching: true}
        },
        uploadInProgress: {progress: {step: steps.carelinkFetch, percentage: 0}}
      };
      let finalState = reducers.uploads(initialState, {
        type: actionTypes.CARELINK_FETCH_REQUEST,
        payload: { userId, deviceKey }
      });
      expect(finalState).to.deep.equal(resultState);
      // tests to be sure not *mutating* state object but rather returning new!
      expect(initialState === finalState).to.be.false;
      expect(initialState.a1b2c3 === finalState.a1b2c3).to.be.false;
      expect(initialState.a1b2c3.carelink === finalState.a1b2c3.carelink).to.be.false;
      expect(initialState.uploadInProgress === finalState.uploadInProgress).to.be.false;
      expect(initialState.uploadInProgress.progress === finalState.uploadInProgress.progress).to.be.false;
    });

    it('should handle CARELINK_FETCH_SUCCESS', () => {
      const userId = 'a1b2c3', deviceKey = 'carelink';
      let initialState = {
        uploadInProgress: {pathToUpload: [userId, deviceKey]},
        a1b2c3: {
          carelink: {history: [], isFetching: true}
        }
      };
      let resultState = {
        uploadInProgress: {pathToUpload: [userId, deviceKey]},
        a1b2c3: {
          carelink: {history: [], isFetching: false}
        }
      };
      let finalState = reducers.uploads(initialState, {
        type: actionTypes.CARELINK_FETCH_SUCCESS
      });
      expect(finalState).to.deep.equal(resultState);
      // tests to be sure not *mutating* state object but rather returning new!
      expect(initialState === finalState).to.be.false;
      expect(initialState.a1b2c3 === finalState.a1b2c3).to.be.false;
      expect(initialState.a1b2c3.carelink === finalState.a1b2c3.carelink).to.be.false;
    });

    it('should handle DEVICE_DETECT_REQUEST', () => {
      const userId = 'a1b2c3', deviceKey = 'a_cgm';
      let initialState = {
        uploadInProgress: {
          progress: {
            step: steps.start,
            percentage: 0
          },
          pathToUpload: ['foo', 'bar']
        }
      };
      let resultState = _.cloneDeep(initialState);
      resultState.uploadInProgress.progress.step = steps.detect;
      let finalState = reducers.uploads(initialState, {
        type: actionTypes.DEVICE_DETECT_REQUEST,
      });
      expect(finalState).to.deep.equal(resultState);
      // tests to be sure not *mutating* state object but rather returning new!
      expect(initialState === finalState).to.be.false;
      expect(initialState.uploadInProgress === finalState.uploadInProgress).to.be.false;
    });

    it('should handle READ_FILE_ABORTED', () => {
      const err = new Error('Wrong file ext!');
      let initialState = {
        a1b2c3: {
          a_pump: {history: []}
        },
        uploadInProgress: {
          pathToUpload: ['a1b2c3', 'a_pump']
        }
      };
      let resultState = {
        a1b2c3: {
          a_pump: {
            completed: true,
            error: err,
            failed: true,
            history: []
          }
        },
        uploadInProgress: false
      };
      let finalState = reducers.uploads(initialState, {
        type: actionTypes.READ_FILE_ABORTED,
        error: true,
        payload: err
      });
      expect(finalState).to.deep.equal(resultState);
      // tests to be sure not *mutating* state object but rather returning new!
      expect(initialState === finalState).to.be.false;
      expect(initialState.a1b2c3 === finalState.a1b2c3).to.be.false;
      expect(initialState.a1b2c3.a_pump === finalState.a1b2c3.a_pump).to.be.false;
    });

    it('should handle READ_FILE_FAILURE', () => {
      const err = new Error('Error reading file!');
      const userId = 'a1b2c3', deviceKey = 'a_cgm';
      const filename = 'foo.csv';
      let initialState = {
        a1b2c3: {
          a_cgm: {
            history: [],
            file: {name: filename}
          }
        },
        uploadInProgress: {
          pathToUpload: [userId, deviceKey]
        }
      };
      let resultState = {
        a1b2c3: {
          a_cgm: {
            completed: true,
            error: err,
            failed: true,
            file: {name: filename},
            history: []
          }
        },
        uploadInProgress: false
      };
      let finalState = reducers.uploads(initialState, {
        type: actionTypes.READ_FILE_FAILURE,
        error: true,
        payload: err
      });
      expect(finalState).to.deep.equal(resultState);
      // tests to be sure not *mutating* state object but rather returning new!
      expect(initialState === finalState).to.be.false;
      expect(initialState.a1b2c3 === finalState.a1b2c3).to.be.false;
      expect(initialState.a1b2c3.a_cgm === finalState.a1b2c3.a_cgm).to.be.false;
    });

    it('should handle READ_FILE_REQUEST', () => {
      const userId = 'a1b2c3', deviceKey = 'a_cgm';
      const filename = 'foo.csv';
      let initialState = {
        a1b2c3: {
          a_cgm: {history: []}
        },
        uploadInProgress: {
          pathToUpload: [userId, deviceKey]
        }
      };
      let resultState = {
        a1b2c3: {
          a_cgm: {
            history: [],
            file: {name: filename}
          }
        },
        uploadInProgress: {
          pathToUpload: [userId, deviceKey]
        }
      };
      let finalState = reducers.uploads(initialState, {
        type: actionTypes.READ_FILE_REQUEST,
        payload: { filename }
      });
      expect(finalState).to.deep.equal(resultState);
      // tests to be sure not *mutating* state object but rather returning new!
      expect(initialState === finalState).to.be.false;
      expect(initialState.a1b2c3 === finalState.a1b2c3).to.be.false;
      expect(initialState.a1b2c3.a_cgm === finalState.a1b2c3.a_cgm).to.be.false;
    });

    it('should handle READ_FILE_SUCCESS', () => {
      const userId = 'a1b2c3', deviceKey = 'a_cgm';
      const filename = 'foo.csv';
      const filedata = [1,2,3,4,5];
      let initialState = {
        a1b2c3: {
          a_cgm: {
            history: [],
            file: {name: filename}
          }
        },
        uploadInProgress: {
          pathToUpload: [userId, deviceKey]
        }
      };
      let resultState = {
        a1b2c3: {
          a_cgm: {
            history: [],
            file: {name: filename, data: filedata}
          }
        },
        uploadInProgress: {
          pathToUpload: [userId, deviceKey]
        }
      };
      let finalState = reducers.uploads(initialState, {
        type: actionTypes.READ_FILE_SUCCESS,
        payload: { userId, deviceKey, filedata }
      });
      expect(finalState).to.deep.equal(resultState);
      // tests to be sure not *mutating* state object but rather returning new!
      expect(initialState === finalState).to.be.false;
      expect(initialState.a1b2c3 === finalState.a1b2c3).to.be.false;
      expect(initialState.a1b2c3.a_cgm === finalState.a1b2c3.a_cgm).to.be.false;
      expect(initialState.a1b2c3.a_cgm.file === finalState.a1b2c3.a_cgm.file).to.be.false;
    });

    it('should handle RESET_UPLOAD [upload successful]', () => {
      const userId = 'a1b2c3', deviceKey = 'a_cgm';
      const time = '2016-01-01T12:05:00.123Z';
      let initialState = {
        uploadInProgress: false,
        a1b2c3: {
          a_cgm: {
            completed: true,
            history: [{
              start: time,
              finish: time
            }],
            successful: true
          },
          a_pump: {
            history: []
          }
        }
      };
      let resultState = {
        uploadInProgress: false,
        a1b2c3: {
          a_cgm: {
            history: [{
              start: time,
              finish: time
            }]
          },
          a_pump: {
            history: []
          }
        }
      };
      let finalState = reducers.uploads(initialState, {
        type: actionTypes.RESET_UPLOAD,
        payload: { userId, deviceKey }
      });
      expect(finalState).to.deep.equal(resultState);
    });

    it('should handle SET_UPLOADS', () => {
      const uploadsByUser = {
        a1b2c3: {a_pump: {}, a_cgm: {}},
        d4e5f6: {another_pump: {}}
      };
      let resultState = {
        a1b2c3: {a_cgm: {completed: true, history: [1,2,3]}, a_pump: {}},
        d4e5f6: {another_pump: {}},
        uploadInProgress: false
      };
      const actionPayload = { uploadsByUser };
      expect(reducers.uploads(undefined, {
        type: actionTypes.SET_UPLOADS,
        payload: { uploadsByUser }
      })).to.deep.equal(_.assign(_.cloneDeep(uploadsByUser), {uploadInProgress: false}));
      let initialState = {
        a1b2c3: {a_meter: {history: [1]}, a_cgm: {completed: true, history: [1,2,3]}},
        uploadInProgress: false
      };
      let finalState = reducers.uploads(initialState, {
        type: actionTypes.SET_UPLOADS,
        payload: { uploadsByUser }
      });
      expect(finalState).to.deep.equal(resultState);
      // we're not changing this, so we expect it to stay the same
      expect(initialState.a1b2c3.a_cgm === finalState.a1b2c3.a_cgm).to.be.true;
      // tests to be sure not *mutating* state object but rather returning new!
      expect(initialState === finalState).to.be.false;
      expect(initialState.a1b2c3 === finalState.a1b2c3).to.be.false;
    });

    it('should handle TOGGLE_ERROR_DETAILS', () => {
      const userId = 'a1b2c3', deviceKey = 'a_cgm';
      let initialState = {
        a1b2c3: {
          a_cgm: {history: []}
        }
      };
      let resultState = {
        a1b2c3: {
          a_cgm: {history: [], showErrorDetails: true}
        }
      };
      let finalState = reducers.uploads(initialState, {
        type: actionTypes.TOGGLE_ERROR_DETAILS,
        payload: { userId, deviceKey, isVisible: true}
      });
      expect(finalState).to.deep.equal(resultState);
      // we're not changing this, so we expect it to stay the same
      expect(initialState.a1b2c3.a_cgm.history === finalState.a1b2c3.a_cgm.history).to.be.true;
      // tests to be sure not *mutating* state object but rather returning new!
      expect(initialState === finalState).to.be.false;
      expect(initialState.a1b2c3 === finalState.a1b2c3).to.be.false;
      expect(initialState.a1b2c3.a_cgm === finalState.a1b2c3.a_cgm).to.be.false;
    });

    it('should handle UPLOAD_FAILURE', () => {
      const userId = 'a1b2c3', deviceKey = 'a_cgm';
      const time = '2016-01-01T12:05:00.123Z';
      const uploadInProgress = {
        pathToUpload: [userId, deviceKey],
        progress: {
          step: steps.start,
          percentage: 0
        }
      };
      let initialState = {
        uploadInProgress: uploadInProgress,
        a1b2c3: {
          a_cgm: {
            history: [{start: time}],
            uploading: true
          },
          a_pump: {
            history: [{foo: 'bar'}],
            disabled: true
          }
        }
      };
      let err = new Error('Upload error');
      err.utc = time;
      let resultState = {
        uploadInProgress: false,
        a1b2c3: {
          a_cgm: {
            completed: true,
            error: err,
            failed: true,
            history: [{start: time, finish: time, error: true}]
          },
          a_pump: {history: [{foo: 'bar'}]}
        }
      };
      let finalState = reducers.uploads(initialState, {
        type: actionTypes.UPLOAD_FAILURE,
        error: true,
        payload: err
      });
      expect(finalState).to.deep.equal(resultState);
      // tests to be sure not *mutating* state object but rather returning new!
      expect(initialState === finalState).to.be.false;
      expect(initialState.a1b2c3 === finalState.a1b2c3).to.be.false;
      expect(initialState.a1b2c3.a_cgm === finalState.a1b2c3.a_cgm).to.be.false;
      expect(initialState.a1b2c3.a_cgm.history === finalState.a1b2c3.a_cgm.history).to.be.false;
      expect(initialState.a1b2c3.a_cgm.history[0] === finalState.a1b2c3.a_cgm.history[0]).to.be.false;
      expect(initialState.a1b2c3.a_pump === finalState.a1b2c3.a_pump).to.be.false;
    });

    it('should handle UPLOAD_PROGRESS', () => {
      const step = 'READ', percentage = 50;
      const actionPayload = { step, percentage };
      let initialState = {
        uploadInProgress: {
          progress: {
            step: 'DETECT',
            percentage: 0
          }
        }
      };
      let resultState = {
        uploadInProgress: {
          progress: { step, percentage }
        }
      };
      let finalState = reducers.uploads(initialState, {
        type: actionTypes.UPLOAD_PROGRESS,
        payload: actionPayload
      });
      expect(finalState).to.deep.equal(resultState);
    });

    it('should handle UPLOAD_REQUEST', () => {
      const userId = 'a1b2c3', deviceKey = 'a_cgm';
      const time = '2016-01-01T12:05:00.123Z';
      const uploadInProgress = {
        pathToUpload: [userId, deviceKey],
        progress: {
          step: steps.start,
          percentage: 0
        }
      };
      const actionPayload = { uploadInProgress, utc: time };
      let initialState = {
        uploadInProgress: false,
        a1b2c3: {
          a_cgm: {history: []},
          a_pump: {history: []}
        }
      };
      let resultState = {
        uploadInProgress: uploadInProgress,
        a1b2c3: {
          a_cgm: {
            history: [{start: time}],
            uploading: true
          },
          a_pump: {
            history: [],
            disabled: true
          }
        }
      };
      let finalState = reducers.uploads(initialState, {
        type: actionTypes.UPLOAD_REQUEST,
        payload: actionPayload
      });
      expect(finalState).to.deep.equal(resultState);
      // tests to be sure not *mutating* state object but rather returning new!
      expect(initialState === finalState).to.be.false;
      expect(initialState.a1b2c3 === finalState.a1b2c3).to.be.false;
      expect(initialState.a1b2c3.a_cgm === finalState.a1b2c3.a_cgm).to.be.false;
      expect(initialState.a1b2c3.a_pump === finalState.a1b2c3.a_pump).to.be.false;
    });

    it('should handle UPLOAD_SUCCESS', () => {
      const userId = 'a1b2c3', deviceKey = 'a_cgm';
      const time = '2016-01-01T12:05:00.123Z';
      const data = [1,2,3,4,5];
      let initialState = {
        uploadInProgress: {
          pathToUpload: [userId, deviceKey],
          progress: {
            step: steps.start,
            percentage: 0
          }
        },
        a1b2c3: {
          a_cgm: {
            history: [{start: time}],
            uploading: true
          },
          a_pump: {
            history: [],
            disabled: true
          }
        }
      };
      let resultState = {
        uploadInProgress: false,
        a1b2c3: {
          a_cgm: {
            completed: true,
            history: [{
              start: time,
              finish: time
            }],
            data: data,
            successful: true
          },
          a_pump: {
            history: []
          }
        }
      };
      let finalState = reducers.uploads(initialState, {
        type: actionTypes.UPLOAD_SUCCESS,
        payload: { userId, deviceKey, data, utc: time }
      });
      expect(finalState).to.deep.equal(resultState);
      // tests to be sure not *mutating* state object but rather returning new!
      expect(initialState === finalState).to.be.false;
      expect(initialState.a1b2c3 === finalState.a1b2c3).to.be.false;
      expect(initialState.a1b2c3.a_cgm === finalState.a1b2c3.a_cgm).to.be.false;
      expect(initialState.a1b2c3.a_cgm.history === finalState.a1b2c3.a_cgm.history).to.be.false;
      expect(initialState.a1b2c3.a_cgm.history[0] === finalState.a1b2c3.a_cgm.history[0]).to.be.false;
      expect(initialState.a1b2c3.a_pump === finalState.a1b2c3.a_pump).to.be.false;
    });
  });

  describe('url', () => {
    it('should return the initial state', () => {
      expect(reducers.url(undefined, {})).to.deep.equal({});
    });

    it('should handle SET_BLIP_VIEW_DATA_URL', () => {
      const VIEW_DATA_LINK = 'http://www.acme.com/patients/a1b2c3/data';
      const actionPayload = {url: VIEW_DATA_LINK};
      expect(reducers.url(undefined, {
        type: actionTypes.SET_BLIP_VIEW_DATA_URL,
        payload: actionPayload
      }).viewDataLink).to.equal(VIEW_DATA_LINK);
      // test to be sure not *mutating* state object but rather returning new!
      let initialState = {};
      let finalState = reducers.url(initialState, {
        type: actionTypes.SET_BLIP_VIEW_DATA_URL,
        payload: actionPayload
      });
      expect(initialState === finalState).to.be.false;
    });

    it('should handle SET_FORGOT_PASSWORD_URL', () => {
      const FORGOT_PWD = 'http://www.acme.com/forgot-password';
      const actionPayload = {url: FORGOT_PWD};
      expect(reducers.url(undefined, {
        type: actionTypes.SET_FORGOT_PASSWORD_URL,
        payload: actionPayload
      }).forgotPassword).to.equal(FORGOT_PWD);
      // test to be sure not *mutating* state object but rather returning new!
      let initialState = {};
      let finalState = reducers.url(initialState, {
        type: actionTypes.SET_FORGOT_PASSWORD_URL,
        payload: actionPayload
      });
      expect(initialState === finalState).to.be.false;
    });

    it('should handle SET_SIGNUP_URL', () => {
      const SIGN_UP = 'http://www.acme.com/sign-up';
      const actionPayload = {url: SIGN_UP};
      expect(reducers.url(undefined, {
        type: actionTypes.SET_SIGNUP_URL,
        payload: actionPayload
      }).signUp).to.equal(SIGN_UP);
      // test to be sure not *mutating* state object but rather returning new!
      let initialState = {};
      let finalState = reducers.url(initialState, {
        type: actionTypes.SET_SIGNUP_URL,
        payload: actionPayload
      });
      expect(initialState === finalState).to.be.false;
    });
  });

  describe('users', () => {
    it('should return the initial state', () => {
      expect(reducers.users(undefined, {})).to.deep.equal({isFetching: false});
    });

    describe('adding a target device for a user', () => {
      it('should handle ADD_TARGET_DEVICE without error when no users', () => {
        const USER = 'a1b2c3', DEVICE = 'a_pump';
        const actionPayload = {
          userId: USER, deviceKey: DEVICE
        };
        let resultState = {
          isFetching: false,
          [USER]: {targets: {devices: [DEVICE]}}
        };
        expect(reducers.users(undefined, {
          type: actionTypes.ADD_TARGET_DEVICE,
          payload: actionPayload
        })).to.deep.equal(resultState);
        // test to be sure not *mutating* state object but rather returning new!
        let initialState = {isFetching: false};
        let finalState = reducers.users(initialState, {
          type: actionTypes.ADD_TARGET_DEVICE,
          payload: actionPayload
        });
        expect(initialState === finalState).to.be.false;
      });

      it('should handle ADD_TARGET_DEVICE without duplicates when user already had device set', () => {
        const USER = 'a1b2c3', DEVICE = 'a_pump';
        const actionPayload = {
          userId: USER, deviceKey: DEVICE
        };
        let initialState = {
          isFetching: false,
          [USER]: {
            fullName: 'Jane Doe',
            targets: {devices: [DEVICE, 'a_cgm']}
          }
        };
        let resultState = _.cloneDeep(initialState);
        let finalState = reducers.users(initialState, {
          type: actionTypes.ADD_TARGET_DEVICE,
          payload: actionPayload
        });
        expect(finalState).to.deep.equal(resultState);
        // tests to be sure not *mutating* state object but rather returning new!
        expect(initialState === finalState).to.be.false;
        expect(initialState[USER] === finalState[USER]).to.be.false;
        expect(initialState[USER].targets === finalState[USER].targets).to.be.false;
        expect(initialState[USER].targets.devices === finalState[USER].targets.devices).to.be.false;
      });

      it('should handle ADD_TARGET_DEVICE without wiping device(s) already set', () => {
        const USER = 'a1b2c3', DEVICE = 'another_pump';
        const actionPayload = {
          userId: USER, deviceKey: DEVICE
        };
        let initialState = {
          isFetching: false,
          [USER]: {
            fullName: 'Jane Doe',
            targets: {devices: ['a_pump', 'a_cgm']}
          }
        };
        let resultState = {
          isFetching: false,
          [USER]: {
            fullName: 'Jane Doe',
            targets: {devices: ['a_pump', 'a_cgm', DEVICE]}
          }
        };
        let finalState = reducers.users(initialState, {
          type: actionTypes.ADD_TARGET_DEVICE,
          payload: actionPayload
        });
        expect(finalState).to.deep.equal(resultState);
        // tests to be sure not *mutating* state object but rather returning new!
        expect(initialState === finalState).to.be.false;
        expect(initialState[USER] === finalState[USER]).to.be.false;
        expect(initialState[USER].targets === finalState[USER].targets).to.be.false;
        expect(initialState[USER].targets.devices === finalState[USER].targets.devices).to.be.false;
      });
    });

    describe('logging in', () => {
      it('should handle LOGIN_FAILURE', () => {
        const errMsg = 'Error logging in!';
        expect(reducers.users(undefined, {
          type: actionTypes.LOGIN_FAILURE,
          error: true,
          payload: new Error(errMsg)
        })).to.deep.equal({
          isFetching: false,
          errorMessage: errMsg
        });
        // test to be sure not *mutating* state object but rather returning new!
        let prevState = {isFetching: true};
        let resultState = reducers.users(prevState, {
          type: actionTypes.LOGIN_FAILURE,
          error: true,
          payload: new Error(errMsg)
        });
        expect(prevState === resultState).to.be.false;
      });

      it('should handle LOGIN_REQUEST', () => {
        expect(reducers.users(undefined, {
          type: actionTypes.LOGIN_REQUEST
        })).to.deep.equal({isFetching: true});
        // test to be sure not *mutating* state object but rather returning new!
        let initialState = {isFetching: false};
        let finalState = reducers.users(initialState, {
          type: actionTypes.LOGIN_REQUEST
        });
        expect(initialState === finalState).to.be.false;
      });

      it('should handle LOGIN_SUCCESS [no error, logged-in PWD]', () => {
        let resultState = {
          isFetching: false,
          loggedInUser: pwd.user.userid,
          [pwd.user.userid]: _.assign({}, _.omit(pwd.user, 'userid'), pwd.profile),
          targetsForUpload: [pwd.user.userid],
          uploadTargetUser: pwd.user.userid
        };
        pwd.memberships.slice(1).map(function(mship) {
          resultState[mship.userid] = _.assign({}, mship.profile);
          resultState.targetsForUpload.push(mship.userid);
        });
        const actionPayload = {
          user: pwd.user,
          profile: pwd.profile,
          memberships: pwd.memberships
        };
        expect(reducers.users(undefined, {
          type: actionTypes.LOGIN_SUCCESS,
          payload: actionPayload
        })).to.deep.equal(resultState);
        // test to be sure not *mutating* state object but rather returning new!
        let initialState = {isFetching: true};
        let finalState = reducers.users(initialState, {
          type: actionTypes.LOGIN_SUCCESS,
          payload: actionPayload
        });
        expect(initialState === finalState).to.be.false;
      });

      it('should handle LOGIN_SUCCESS [no error, logged-in non-PWD, can upload to one]', () => {
        let resultState = {
          isFetching: false,
          loggedInUser: nonpwd.user.userid,
          [nonpwd.user.userid]: _.assign({}, _.omit(nonpwd.user, 'userid'), nonpwd.profile),
          targetsForUpload: [],
          uploadTargetUser: nonpwd.memberships[1].userid
        };
        nonpwd.memberships.slice(1,2).map(function(mship) {
          resultState[mship.userid] = _.assign({}, mship.profile);
          resultState.targetsForUpload.push(mship.userid);
        });
        const actionPayload = {
          user: nonpwd.user,
          profile: nonpwd.profile,
          memberships: nonpwd.memberships.slice(0,2)
        };
        expect(reducers.users(undefined, {
          type: actionTypes.LOGIN_SUCCESS,
          payload: actionPayload
        })).to.deep.equal(resultState);
        // test to be sure not *mutating* state object but rather returning new!
        let initialState = {isFetching: true};
        let finalState = reducers.users(initialState, {
          type: actionTypes.LOGIN_SUCCESS,
          payload: actionPayload
        });
        expect(initialState === finalState).to.be.false;
      });

      it('should handle LOGIN_SUCCESS [no error, logged-in non-PWD, can upload to > 1]', () => {
        let resultState = {
          isFetching: false,
          loggedInUser: nonpwd.user.userid,
          [nonpwd.user.userid]: _.assign({}, _.omit(nonpwd.user, 'userid'), nonpwd.profile),
          targetsForUpload: [],
          uploadTargetUser: null
        };
        nonpwd.memberships.slice(1).map(function(mship) {
          resultState[mship.userid] = _.assign({}, mship.profile);
          resultState.targetsForUpload.push(mship.userid);
        });
        const actionPayload = {
          user: nonpwd.user,
          profile: nonpwd.profile,
          memberships: nonpwd.memberships
        };
        expect(reducers.users(undefined, {
          type: actionTypes.LOGIN_SUCCESS,
          payload: actionPayload
        })).to.deep.equal(resultState);
        // test to be sure not *mutating* state object but rather returning new!
        let initialState = {isFetching: true};
        let finalState = reducers.users(initialState, {
          type: actionTypes.LOGIN_SUCCESS,
          payload: actionPayload
        });
        expect(initialState === finalState).to.be.false;
      });
    });

    describe('logging out', () => {
      it('should handle LOGOUT_REQUEST by restoring to initial state', () => {
        let blankSlate = reducers.users(undefined, {type: 'foo'});
        let initialState = {
          isFetching: false,
          a1b2c3: {
            fullName: 'Jane Doe',
            targets: {devices: ['a_pump', 'a_cgm']}
          },
          loggedInUser: 'a1b2c3'
        };
        let finalState = reducers.users(initialState, {
          type: actionTypes.LOGOUT_REQUEST
        });
        expect(finalState).to.deep.equal(blankSlate);
        expect(initialState === finalState).to.be.false;
      });
    });

    describe('removing a target device for a user', () => {
      it('should handle REMOVE_TARGET_DEVICE without error when no users', () => {
        const USER = 'a1b2c3', DEVICE = 'a_pump';
        const actionPayload = {
          userId: USER, deviceKey: DEVICE
        };
        let resultState = {
          isFetching: false
        };
        expect(reducers.users(undefined, {
          type: actionTypes.REMOVE_TARGET_DEVICE,
          payload: actionPayload
        })).to.deep.equal(resultState);
        // test to be sure not *mutating* state object but rather returning new!
        let initialState = {isFetching: false};
        let finalState = reducers.users(initialState, {
          type: actionTypes.REMOVE_TARGET_DEVICE,
          payload: actionPayload
        });
        expect(initialState === finalState).to.be.false;
      });

      it('should handle REMOVE_TARGET_DEVICE without wiping other device(s) already set', () => {
        const USER = 'a1b2c3', DEVICE = 'another_pump';
        const actionPayload = {
          userId: USER, deviceKey: DEVICE
        };
        let initialState = {
          isFetching: false,
          [USER]: {
            fullName: 'Jane Doe',
            targets: {devices: [DEVICE, 'a_pump', 'a_cgm']}
          }
        };
        let resultState = {
          isFetching: false,
          [USER]: {
            fullName: 'Jane Doe',
            targets: {devices: ['a_pump', 'a_cgm']}
          }
        };
        let finalState = reducers.users(initialState, {
          type: actionTypes.REMOVE_TARGET_DEVICE,
          payload: actionPayload
        });
        expect(finalState).to.deep.equal(resultState);
        // tests to be sure not *mutating* state object but rather returning new!
        expect(initialState === finalState).to.be.false;
        expect(initialState[USER] === finalState[USER]).to.be.false;
        expect(initialState[USER].targets === finalState[USER].targets).to.be.false;
        expect(initialState[USER].targets.devices === finalState[USER].targets.devices).to.be.false;
      });
    });

    describe('setting the target timezone for a user', () => {
      it('should handle SET_TARGET_TIMEZONE without error when no users', () => {
        const USER = 'a1b2c3', TIMEZONE = 'US/Mountain';
        const actionPayload = {
          userId: USER, timezoneName: TIMEZONE
        };
        let resultState = {
          isFetching: false,
          [USER]: {targets: {timezone: TIMEZONE}}
        };
        expect(reducers.users(undefined, {
          type: actionTypes.SET_TARGET_TIMEZONE,
          payload: actionPayload
        })).to.deep.equal(resultState);
        // test to be sure not *mutating* state object but rather returning new!
        let initialState = {isFetching: false};
        let finalState = reducers.users(initialState, {
          type: actionTypes.SET_TARGET_TIMEZONE,
          payload: actionPayload
        });
        expect(initialState === finalState).to.be.false;
      });

      it('should handle SET_TARGET_TIMEZONE by replacing user\'s timezone when already set', () => {
        const USER = 'a1b2c3', TIMEZONE = 'Pacific/Honolulu';
        const actionPayload = {
          userId: USER, timezoneName: TIMEZONE
        };
        let initialState = {
          isFetching: false,
          [USER]: {
            fullName: 'Jane Doe',
            targets: {devices: ['a_pump', 'a_cgm'], timezone: 'US/Mountain'}
          }
        };
        let resultState = {
          isFetching: false,
          [USER]: {
            fullName: 'Jane Doe',
            targets: {devices: ['a_pump', 'a_cgm'], timezone: 'Pacific/Honolulu'}
          }
        };
        let finalState = reducers.users(initialState, {
          type: actionTypes.SET_TARGET_TIMEZONE,
          payload: actionPayload
        });
        expect(finalState).to.deep.equal(resultState);
        // we're not changing this, so we expect it to stay the same
        expect(initialState[USER].targets.devices === finalState[USER].targets.devices)
          .to.be.true;
        // tests to be sure not *mutating* state object but rather returning new!
        expect(initialState === finalState).to.be.false;
        expect(initialState[USER] === finalState[USER]).to.be.false;
        expect(initialState[USER].targets === finalState[USER].targets).to.be.false;
        expect(initialState[USER].targets.timezone === finalState[USER].targets.timezone).to.be.false;
      });
    });

    describe('setting the target user for data upload', () => {
      it('should handle SET_UPLOAD_TARGET_USER without error when no users', () => {
        const USER = 'a1b2c3';
        const actionPayload = {
          userId: USER
        };
        let resultState = {
          isFetching: false,
          uploadTargetUser: USER
        };
        expect(reducers.users(undefined, {
          type: actionTypes.SET_UPLOAD_TARGET_USER,
          payload: actionPayload
        })).to.deep.equal(resultState);
        // test to be sure not *mutating* state object but rather returning new!
        let initialState = {isFetching: false};
        let finalState = reducers.users(initialState, {
          type: actionTypes.SET_UPLOAD_TARGET_USER,
          payload: actionPayload
        });
        expect(initialState === finalState).to.be.false;
      });

      it('should handle SET_UPLOAD_TARGET_USER by replacing uploadTargetUser when already set', () => {
        const USER = 'a1b2c3';
        const actionPayload = {
          userId: USER
        };
        let initialState = {
          isFetching: false,
          uploadTargetUser: 'd4e5f6'
        };
        let resultState = {
          isFetching: false,
          uploadTargetUser: USER
        };
        let finalState = reducers.users(initialState, {
          type: actionTypes.SET_UPLOAD_TARGET_USER,
          payload: actionPayload
        });
        expect(finalState).to.deep.equal(resultState);
        // tests to be sure not *mutating* state object but rather returning new!
        expect(initialState === finalState).to.be.false;
      });
    });

    describe('"logging in" via stored token, getting & setting user info', () => {
      it('should handle SET_USER_INFO_FROM_TOKEN [no error, logged-in PWD]', () => {
        let resultState = {
          isFetching: false,
          loggedInUser: pwd.user.userid,
          [pwd.user.userid]: _.assign({}, _.omit(pwd.user, 'userid'), pwd.profile),
          targetsForUpload: [pwd.user.userid],
          uploadTargetUser: pwd.user.userid
        };
        pwd.memberships.slice(1).map(function(mship) {
          resultState[mship.userid] = _.assign({}, mship.profile);
          resultState.targetsForUpload.push(mship.userid);
        });
        const actionPayload = {
          user: pwd.user,
          profile: pwd.profile,
          memberships: pwd.memberships
        };
        expect(reducers.users(undefined, {
          type: actionTypes.SET_USER_INFO_FROM_TOKEN,
          payload: actionPayload
        })).to.deep.equal(resultState);
        // test to be sure not *mutating* state object but rather returning new!
        let initialState = {isFetching: true};
        let finalState = reducers.users(initialState, {
          type: actionTypes.SET_USER_INFO_FROM_TOKEN,
          payload: actionPayload
        });
        expect(initialState === finalState).to.be.false;
      });

      it('should handle SET_USER_INFO_FROM_TOKEN [no error, logged-in non-PWD, can upload to one]', () => {
        let resultState = {
          isFetching: false,
          loggedInUser: nonpwd.user.userid,
          [nonpwd.user.userid]: _.assign({}, _.omit(nonpwd.user, 'userid'), nonpwd.profile),
          targetsForUpload: [],
          uploadTargetUser: nonpwd.memberships[1].userid
        };
        nonpwd.memberships.slice(1,2).map(function(mship) {
          resultState[mship.userid] = _.assign({}, mship.profile);
          resultState.targetsForUpload.push(mship.userid);
        });
        const actionPayload = {
          user: nonpwd.user,
          profile: nonpwd.profile,
          memberships: nonpwd.memberships.slice(0,2)
        };
        expect(reducers.users(undefined, {
          type: actionTypes.SET_USER_INFO_FROM_TOKEN,
          payload: actionPayload
        })).to.deep.equal(resultState);
        // test to be sure not *mutating* state object but rather returning new!
        let initialState = {isFetching: true};
        let finalState = reducers.users(initialState, {
          type: actionTypes.SET_USER_INFO_FROM_TOKEN,
          payload: actionPayload
        });
        expect(initialState === finalState).to.be.false;
      });

      it('should handle SET_USER_INFO_FROM_TOKEN [no error, logged-in non-PWD, can upload to > 1]', () => {
        let resultState = {
          isFetching: false,
          loggedInUser: nonpwd.user.userid,
          [nonpwd.user.userid]: _.assign({}, _.omit(nonpwd.user, 'userid'), nonpwd.profile),
          targetsForUpload: [],
          uploadTargetUser: null
        };
        nonpwd.memberships.slice(1).map(function(mship) {
          resultState[mship.userid] = _.assign({}, mship.profile);
          resultState.targetsForUpload.push(mship.userid);
        });
        const actionPayload = {
          user: nonpwd.user,
          profile: nonpwd.profile,
          memberships: nonpwd.memberships
        };
        expect(reducers.users(undefined, {
          type: actionTypes.SET_USER_INFO_FROM_TOKEN,
          payload: actionPayload
        })).to.deep.equal(resultState);
        // test to be sure not *mutating* state object but rather returning new!
        let initialState = {isFetching: true};
        let finalState = reducers.users(initialState, {
          type: actionTypes.SET_USER_INFO_FROM_TOKEN,
          payload: actionPayload
        });
        expect(initialState === finalState).to.be.false;
      });      
    });

    describe('setting users\' targets after retrieving them from local storage', () => {
      it('should handle SET_USERS_TARGETS without changing state if stored userids not accessible to logged-in user (anymore)', () => {
        const TARGETS = {
          abc123: [{key: 'a_pump', timezone: 'US/Central'}]
        };
        const actionPayload = {
          targets: TARGETS
        };
        const initialState = {
          isFetching: false,
          loggedInUser: 'a1b2c3'
        };
        let resultState = _.cloneDeep(initialState);
        let finalState = reducers.users(initialState, {
          type: actionTypes.SET_USERS_TARGETS,
          payload: actionPayload
        });
        expect(finalState).to.deep.equal(resultState);
        // test to be sure not *mutating* state object but rather returning new!
        expect(initialState === finalState).to.be.false;
      });

      it('should handle SET_USERS_TARGETS by adding targets for users accessible to logged-in user', () => {
        const TARGETS = {
          a1b2c3: [{key: 'a_pump', timezone: 'US/Central'}],
          d4e5f6: [
            {key: 'a_pump', timezone: 'US/Central'},
            {key: 'a_cgm', timezone: 'US/Mountain'}
          ]
        };
        const actionPayload = {
          targets: TARGETS
        };
        const initialState = {
          isFetching: false,
          loggedInUser: 'a1b2c3',
          a1b2c3: {
            fullName: 'Jane Doe'
          },
          d4e5f6: {
            fullName: 'Michael Jackson'
          }
        };
        let resultState = {
          isFetching: false,
          loggedInUser: 'a1b2c3',
          a1b2c3: {
            fullName: 'Jane Doe',
            targets: {devices: ['a_pump'], timezone: 'US/Central'}
          },
          d4e5f6: {
            fullName: 'Michael Jackson',
            targets: {devices: ['a_pump', 'a_cgm'], timezone: null}
          }
        };
        let finalState = reducers.users(initialState, {
          type: actionTypes.SET_USERS_TARGETS,
          payload: actionPayload
        });
        expect(finalState).to.deep.equal(resultState);
        // tests to be sure not *mutating* state object but rather returning new!
        expect(initialState === finalState).to.be.false;
        expect(initialState.a1b2c3 === finalState.a1b2c3).to.be.false;
        expect(initialState.d4e5f6 === finalState.d4e5f6).to.be.false;
      });
    });

    describe('should handle STORING_USERS_TARGETS by clearing any targets stored under `noUserSelected`', () => {
      const initialState = {
        noUserSelected: {
          targets: {
            devices: ['a_pump', 'a_cgm'],
            timezone: 'Europe/Budapest'
          }
        },
        a1b2c3: {
          targets: {
            devices: ['another_pump', 'a_cgm'],
            timezone: 'Europe/Budapest'
          }
        }
      };
      let resultState = {
        a1b2c3: {
          targets: {
            devices: ['another_pump', 'a_cgm'],
            timezone: 'Europe/Budapest'
          }
        }
      };
      let finalState = reducers.users(initialState, {
        type: actionTypes.STORING_USERS_TARGETS
      });
      expect(finalState).to.deep.equal(resultState);
        // we're not changing this, so we expect it to stay the same
      expect(initialState.a1b2c3 === finalState.a1b2c3).to.be.true;
      // tests to be sure not *mutating* state object but rather returning new!
      expect(initialState === finalState).to.be.false;
    });
  });

  describe('version', () => {
    it('should return the initial state', () => {
      expect(reducers.version(undefined, {})).to.be.null;
    });

    it('should handle SET_VERSION', () => {
      expect(reducers.version(undefined, {
        type: actionTypes.SET_VERSION,
        payload: {version: '0.100.0'}
      })).to.deep.equal('0.100.0');
    });
  });
});