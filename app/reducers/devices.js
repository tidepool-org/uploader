import mm723Image from '../../images/MM723_CNL_combo@2x.jpg';
const devices = {
  carelink: {
    instructions: ['Import from CareLink', '(We will not store your credentials)'],
    isFetching: false,
    key: 'carelink',
    name: 'Medtronic',
    // for the device selection list
    selectName: 'Medtronic (from CareLink)',
    source: {type: 'carelink'},
    enabled: {mac: true, win: true}
  },
  medtronic: {
    instructions: 'Connect your Bayer Contour Next Link to your computer',
    image: {
      'src': mm723Image,
      'height': 128,
      'width': 200,
      'alt': 'Bayer Contour Next Link'
    },
    key: 'medtronic',
    name: 'Medtronic - 523, 723 or 530G',
    selectName: 'Medtronic direct from Bayer Contour Next Link',
    source: {type: 'device', driverId: 'Medtronic'},
    enabled: {mac: true, win: true}
  },
  omnipod: {
    instructions: 'Plug in PDM with mini-USB and choose .ibf file from PDM',
    key: 'omnipod',
    name: 'Insulet OmniPod',
    source: {type: 'block', driverId: 'InsuletOmniPod', extension: '.ibf'},
    enabled: {mac: true, win: true}
  },
  dexcom: {
    instructions: 'Plug in receiver with micro-USB',
    key: 'dexcom',
    name: 'Dexcom',
    source: {type: 'device', driverId: 'Dexcom'},
    enabled: {mac: true, win: true}
  },
  precisionxtra: {
    instructions: 'Plug in meter with cable',
    key: 'precisionxtra',
    name: 'Abbott Precision Xtra',
    source: {type: 'device', driverId: 'AbbottPrecisionXtra'},
    enabled: {mac: false, win: true}
  },
  tandem: {
    instructions: 'Plug in pump with micro-USB',
    key: 'tandem',
    name: 'Tandem',
    source: {type: 'device', driverId: 'Tandem'},
    enabled: {mac: true, win: true}
  },
  abbottfreestylelite: {
    instructions: 'Plug in meter with cable',
    key: 'abbottfreestylelite',
    name: 'Abbott FreeStyle Lite',
    source: {type: 'device', driverId: 'AbbottFreeStyleLite'},
    enabled: {mac: false, win: true}
  },
  abbottfreestylefreedomlite: {
    instructions: 'Plug in meter with cable',
    key: 'abbottfreestylefreedomlite',
    name: 'Abbott FreeStyle Freedom Lite',
    source: {type: 'device', driverId: 'AbbottFreeStyleFreedomLite'},
    enabled: {mac: false, win: true}
  },
  abbottfreestylelibre: {
    instructions: 'Plug in meter with micro-USB',
    key: 'abbottfreestylelibre',
    name: 'Abbott FreeStyle Libre',
    showDriverLink: {linux: false, mac: false, win: false},
    source: {type: 'device', driverId: 'AbbottFreeStyleLibre'},
    enabled: {linux: true, mac: true, win: true}
  },
  bayercontournext: {
    instructions: 'Plug in meter with micro-USB',
    key: 'bayercontournext',
    name: 'Bayer Contour Next',
    source: {type: 'device', driverId: 'BayerContourNext'},
    enabled: {mac: true, win: true}
  },
  bayercontournextusb: {
    instructions: 'Plug meter into USB port',
    key: 'bayercontournextusb',
    name: 'Bayer Contour Next USB',
    source: {type: 'device', driverId: 'BayerContourNextUsb'},
    enabled: {mac: true, win: true}
  },
  bayercontourusb: {
    instructions: 'Plug meter into USB port',
    key: 'bayercontourusb',
    name: 'Bayer Contour USB',
    source: {type: 'device', driverId: 'BayerContourUsb'},
    enabled: {mac: true, win: true}
  },
  bayercontournextlink: {
    instructions: 'Plug meter into USB port',
    key: 'bayercontournextlink',
    name: 'Bayer Contour Next Link',
    source: {type: 'device', driverId: 'BayerContourNextLink'},
    enabled: {mac: true, win: true}
  },
  animas: {
    instructions: 'Suspend and align back of pump with IR dongle front',
    key: 'animas',
    name: 'Animas',
    source: {type: 'device', driverId: 'Animas'},
    enabled: {mac: true, win: true}
  },
  onetouchverioiq: {
    instructions: 'Plug in meter with mini-USB',
    name: 'OneTouch VerioIQ',
    key: 'onetouchverioiq',
    source: {type: 'device', driverId: 'OneTouchVerioIQ'},
    enabled: {mac: true, win: true}
  },
  /* TODO: re-enable these after Electron is on production
  onetouchultramini: {
    instructions: 'Plug in meter with cable',
    name: 'OneTouch Ultra Mini',
    key: 'onetouchultramini',
    showDriverLink: {mac: true, win: true},
    source: {type: 'device', driverId: 'OneTouchUltraMini'},
    enabled: {mac: true, win: true}
  },
  onetouchultra2: {
    instructions: 'Plug in meter with cable',
    name: 'OneTouch Ultra2',
    key: 'onetouchultra2',
    showDriverLink: {mac: true, win: true},
    source: {type: 'device', driverId: 'OneTouchUltra2'},
    enabled: {mac: true, win: true}
  }
  */
};

export default devices;
