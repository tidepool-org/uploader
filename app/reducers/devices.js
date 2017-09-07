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
    enabled: {mac: true, win: true},
    usb: [
      {vendorId: 6777, productId: 25344}, // Bayer Contour Next Link mmol/L
      {vendorId: 6777, productId: 25088}  // Bayer Contour Next Link
    ]
  },
  omnipod: {
    instructions: 'Plug in PDM with mini-USB and choose .ibf file from PDM',
    key: 'omnipod',
    name: 'Insulet OmniPod',
    source: {type: 'block', driverId: 'InsuletOmniPod', extension: '.ibf'},
    enabled: {mac: true, win: true},
    mode: 'block',
    usb: [
      {vendorId: 7734, productId: 2}
    ]
  },
  dexcom: {
    instructions: 'Plug in receiver with micro-USB',
    key: 'dexcom',
    name: 'Dexcom',
    source: {type: 'device', driverId: 'Dexcom'},
    enabled: {mac: true, win: true},
    mode: 'serial',
    usb: [
      {vendorId: 8867, productId: 71}
    ]
  },
  precisionxtra: {
    instructions: 'Plug in meter with cable',
    key: 'precisionxtra',
    name: 'Abbott Precision Xtra',
    source: {type: 'device', driverId: 'AbbottPrecisionXtra'},
    enabled: {mac: false, win: true},
    mode: 'serial',
    usb: [
      {vendorId: 6753, productId: 13344}
    ]
  },
  tandem: {
    instructions: 'Plug in pump with micro-USB',
    key: 'tandem',
    name: 'Tandem',
    source: {type: 'device', driverId: 'Tandem'},
    enabled: {mac: true, win: true},
    mode: 'serial',
    bitrate: 921600,
    sendTimeout: 50,
    receiveTimeout: 50,
    usb: [
      {vendorId: 1155, productId: 22336}
    ]
  },
  abbottfreestylelite: {
    instructions: 'Plug in meter with cable',
    key: 'abbottfreestylelite',
    name: 'Abbott FreeStyle Lite & FreeStyle Freedom Lite',
    source: {type: 'device', driverId: 'AbbottFreeStyleLite'},
    enabled: {mac: false, win: true},
    bitrate: 19200,
    mode: 'serial',
    usb: [
      {vendorId: 6753, productId: 13328}, // Abbott cable
      {vendorId: 1027, productId: 24577}  // FTDI cable
    ]
  },
  bayercontournext: {
    instructions: 'Plug meter into USB port',
    key: 'bayercontournext',
    name: 'Bayer Contour Next',
    source: {type: 'device', driverId: 'BayerContourNext'},
    enabled: {mac: true, win: true},
    mode: 'HID',
    usb: [
      {vendorId: 6777, productId: 29520}, // Bayer Contour Next
      {vendorId: 6777, productId: 29712}, // Bayer Contour Next USB
      {vendorId: 6777, productId: 25088}, // Bayer Contour Next Link
      {vendorId: 6777, productId: 25344}, // Bayer Contour Next Link mmol/L
      {vendorId: 6777, productId: 25104}, // Bayer Contour Next Link 2.4
      {vendorId: 6777, productId: 24578}  // Bayer Contour USB
    ]
  },
  animas: {
    instructions: 'Suspend and align back of pump with IR dongle front',
    key: 'animas',
    name: 'Animas',
    source: {type: 'device', driverId: 'Animas'},
    enabled: {mac: true, win: true},
    mode: 'serial',
    bitrate: 9600,
    ctsFlowControl: true,
    sendTimeout: 500,
    receiveTimeout: 500,
    usb: [
      {vendorId: 1659, productId: 8963}
    ]
  },
  onetouchverioiq: {
    instructions: 'Plug in meter with mini-USB',
    name: 'OneTouch VerioIQ',
    key: 'onetouchverioiq',
    source: {type: 'device', driverId: 'OneTouchVerioIQ'},
    enabled: {mac: true, win: true},
    mode: 'serial',
    bitrate: 38400,
    usb: [
      {vendorId: 4292, productId: 34215}
    ]
  },
  /* TODO: re-enable these after Electron is on production
  onetouchultramini: {
    instructions: 'Plug in meter with cable',
    name: 'OneTouch Ultra Mini',
    key: 'onetouchultramini',
    showDriverLink: {mac: true, win: true},
    source: {type: 'device', driverId: 'OneTouchUltraMini'},
    enabled: {mac: true, win: true},
    mode: 'serial',
    usb: [
      { vendorId: 1027, productId: 24577 }
    ]
  },
  onetouchultra2: {
    instructions: 'Plug in meter with cable',
    name: 'OneTouch Ultra2',
    key: 'onetouchultra2',
    showDriverLink: {mac: true, win: true},
    source: {type: 'device', driverId: 'OneTouchUltra2'},
    enabled: {mac: true, win: true},
    mode: 'serial',
    bitrate: 9600,
    sendTimeout: 5000,
    receiveTimeout: 5000,
    usb: [
      {vendorId: 1027, productId: 24577}
    ]
  }
  */
};

export default devices;
