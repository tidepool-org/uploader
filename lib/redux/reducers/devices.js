let devices = {
  carelink: {
    key: 'carelink',
    name: 'Medtronic (from CareLink)',
    source: {type: 'carelink'}
  },
  omnipod: {
    key: 'omnipod',
    name: 'Insulet OmniPod',
    source: {type: 'block', driverId: 'InsuletOmniPod', extension: '.ibf'}
  },
  dexcom: {
    key: 'dexcom',
    name: 'Dexcom G4',
    source: {type: 'device', driverId: 'DexcomG4'}
  },
  precisionxtra: {
    key: 'precisionxtra',
    name: 'Abbott Precision Xtra',
    source: {type: 'device', driverId: 'AbbottPrecisionXtra'}
  },
  tandem: {
    key: 'tandem',
    name: 'Tandem',
    source: {type: 'device', driverId: 'Tandem'}
  },
  abbottfreestylelite: {
    key: 'abbottfreestylelite',
    name: 'Abbott FreeStyle Lite',
    source: {type: 'device', driverId: 'AbbottFreeStyleLite'}
  },
  abbottfreestylefreedomlite: {
    key: 'abbottfreestylefreedomlite',
    name: 'Abbott FreeStyle Freedom Lite',
    source: {type: 'device', driverId: 'AbbottFreeStyleFreedomLite'}
  },
  bayercontournext: {
    key: 'bayercontournext',
    name: 'Bayer Contour Next',
    source: {type: 'device', driverId: 'BayerContourNext'}
  },
  bayercontournextusb: {
    key: 'bayercontournextusb',
    name: 'Bayer Contour Next USB',
    source: {type: 'device', driverId: 'BayerContourNextUsb'}
  },
  bayercontourusb: {
    key: 'bayercontourusb',
    name: 'Bayer Contour USB',
    source: {type: 'device', driverId: 'BayerContourUsb'}
  },
  bayercontournextlink: {
    key: 'bayercontournextlink',
    name: 'Bayer Contour Next LINK',
    source: {type: 'device', driverId: 'BayerContourNextLink'}
  }
};

export default devices;
