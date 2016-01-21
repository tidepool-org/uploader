let devices = {
  carelink: {
    key: 'carelink',
    name: 'Medtronic (from CareLink)',
    showDriverLink: {mac: false, win: false},
    source: {type: 'carelink'},
    enabled: {mac: true, win: true}
  },
  omnipod: {
    key: 'omnipod',
    name: 'Insulet OmniPod',
    showDriverLink: {mac: false, win: false},
    source: {type: 'block', driverId: 'InsuletOmniPod', extension: '.ibf'},
    enabled: {mac: true, win: true}
  },
  dexcom: {
    key: 'dexcom',
    name: 'Dexcom',
    showDriverLink: {mac: true, win: true},
    source: {type: 'device', driverId: 'Dexcom'},
    enabled: {mac: true, win: true}
  },
  precisionxtra: {
    key: 'precisionxtra',
    name: 'Abbott Precision Xtra',
    showDriverLink: {mac: false, win: true},
    source: {type: 'device', driverId: 'AbbottPrecisionXtra'},
    enabled: {mac: false, win: true}
  },
  tandem: {
    key: 'tandem',
    name: 'Tandem',
    showDriverLink: {mac: false, win: true},
    source: {type: 'device', driverId: 'Tandem'},
    enabled: {mac: true, win: true}
  },
  abbottfreestylelite: {
    key: 'abbottfreestylelite',
    name: 'Abbott FreeStyle Lite',
    showDriverLink: {mac: false, win: true},
    source: {type: 'device', driverId: 'AbbottFreeStyleLite'},
    enabled: {mac: false, win: true}
  },
  abbottfreestylefreedomlite: {
    key: 'abbottfreestylefreedomlite',
    name: 'Abbott FreeStyle Freedom Lite',
    showDriverLink: {mac: false, win: true},
    source: {type: 'device', driverId: 'AbbottFreeStyleFreedomLite'},
    enabled: {mac: false, win: true}
  },
  bayercontournext: {
    key: 'bayercontournext',
    name: 'Bayer Contour Next',
    showDriverLink: {mac: false, win: false},
    source: {type: 'device', driverId: 'BayerContourNext'},
    enabled: {mac: true, win: true}
  },
  bayercontournextusb: {
    key: 'bayercontournextusb',
    name: 'Bayer Contour Next USB',
    showDriverLink: {mac: false, win: false},
    source: {type: 'device', driverId: 'BayerContourNextUsb'},
    enabled: {mac: true, win: true}
  },
  bayercontourusb: {
    key: 'bayercontourusb',
    name: 'Bayer Contour USB',
    showDriverLink: {mac: false, win: false},
    source: {type: 'device', driverId: 'BayerContourUsb'},
    enabled: {mac: true, win: true}
  },
  bayercontournextlink: {
    key: 'bayercontournextlink',
    name: 'Bayer Contour Next LINK',
    showDriverLink: {mac: false, win: false},
    source: {type: 'device', driverId: 'BayerContourNextLink'},
    enabled: {mac: true, win: true}
  }
};

export default devices;
