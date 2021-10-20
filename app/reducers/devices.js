import mm723Image from '../../images/MM723_CNL_combo@2x.jpg';
import mm600Image from '../../images/MM600_CNL_combo@2x.jpg';

import os from 'os';

const devices = {
  accuchekusb: {
    instructions: 'Plug in meter with micro-USB cable',
    name: 'Roche Accu-Chek Aviva Connect, Instant, Guide & Guide Me',
    key: 'accuchekusb',
    source: {type: 'device', driverId: 'AccuChekUSB'},
    enabled: {mac: true, win: true, linux: true}
  },
  carelink: {
    instructions: ['Import from CareLink', '(We will not store your credentials)'],
    isFetching: false,
    key: 'carelink',
    name: 'Medtronic',
    // for the device selection list
    selectName: 'Medtronic (CareLink import)',
    source: {type: 'carelink'},
    enabled: {mac: true, win: true, linux: true}
  },
  caresensble: {
    instructions: 'Once paired, hold in right arrow until "BT Send" appears on the screen',
    name: 'CareSens N Premier & Dual (using Bluetooth)',
    key: 'caresensble',
    source: {type: 'device', driverId: 'BluetoothLE'},
    enabled: {mac: true, win: false, linux: true}
  },
  medtronic: {
    instructions: 'Connect your Contour Next Link to your computer',
    image: {
      'src': mm723Image,
      'height': 128,
      'width': 200,
      'alt': 'Contour Next Link'
    },
    key: 'medtronic',
    name: 'Medtronic 523, 723, Veo or 530G',
    selectName: 'Medtronic 523, 723, Veo or 530G (using Contour Next Link)',
    source: {type: 'device', driverId: 'Medtronic'},
    enabled: {mac: true, win: true, linux: true}
  },
  medtronic600: {
    instructions: 'Connect your Contour Next Link 2.4 to your computer',
    image: {
      'src': mm600Image,
      'height': 128,
      'width': 200,
      'alt': 'Bayer Contour Next Link 2.4'
    },
    key: 'medtronic600',
    name: 'Medtronic 630G, 640G or 670G',
    selectName: 'Medtronic 630G, 640G, 670G (using Contour Next Link 2.4)',
    showDriverLink: {mac: false, win: false},
    source: {type: 'device', driverId: 'Medtronic600'},
    enabled: {mac: true, win: true, linux: true}
  },
  omnipod: {
    instructions: os.platform() === 'win32' ? 'Plug in PDM with USB cable and choose .ibf file from PDM' : 'Plug in PDM with USB cable',
    key: 'omnipod',
    name: 'Insulet OmniPod',
    source: {type: os.platform() === 'win32' ? 'block' : 'device', driverId: 'InsuletOmniPod', extension: '.ibf'},
    enabled: {mac: true, win: true, linux: true}
  },
  dexcom: {
    instructions: 'Plug in receiver with micro-USB',
    key: 'dexcom',
    name: 'Dexcom',
    source: {type: 'device', driverId: 'Dexcom'},
    enabled: {mac: true, win: true, linux: true}
  },
  precisionxtra: {
    instructions: 'Plug in meter with cable',
    key: 'precisionxtra',
    name: 'Abbott Precision Xtra',
    source: {type: 'device', driverId: 'AbbottPrecisionXtra'},
    enabled: {mac: false, win: true, linux: true}
  },
  tandem: {
    instructions: 'Plug in pump with micro-USB',
    key: 'tandem',
    name: 'Tandem',
    source: {type: 'device', driverId: 'Tandem'},
    enabled: {mac: true, win: true, linux: true}
  },
  abbottfreestylelite: {
    instructions: 'Plug in meter with cable',
    key: 'abbottfreestylelite',
    name: 'Abbott FreeStyle Lite & Freedom Lite',
    source: {type: 'device', driverId: 'AbbottFreeStyleLite'},
    enabled: {mac: false, win: true, linux: true}
  },
  abbottfreestylelibre: {
    instructions: 'Plug in meter with micro-USB cable',
    key: 'abbottfreestylelibre',
    name: 'Abbott FreeStyle Libre',
    source: {type: 'device', driverId: 'AbbottFreeStyleLibre'},
    enabled: {linux: true, mac: true, win: true}
  },
  bayercontournext: {
    instructions: 'Plug meter into USB port',
    key: 'bayercontournext',
    name: 'Ascensia (Bayer) Contour Next',
    source: {type: 'device', driverId: 'BayerContourNext'},
    enabled: {mac: true, win: true, linux: true}
  },
  animas: {
    instructions: 'Suspend and align back of pump with IR dongle front',
    key: 'animas',
    name: 'Animas',
    source: {type: 'device', driverId: 'Animas'},
    enabled: {mac: true, win: true, linux: true}
  },
  onetouchverio: {
    instructions: 'Plug in meter with micro-USB',
    name: 'OneTouch Verio & Verio Flex',
    key: 'onetouchverio',
    source: {type: 'device', driverId: 'OneTouchVerio'},
    enabled: {linux: true, mac: true, win: true}
  },
  onetouchverioiq: {
    instructions: 'Plug in meter with mini-USB',
    name: 'OneTouch VerioIQ',
    key: 'onetouchverioiq',
    source: {type: 'device', driverId: 'OneTouchVerioIQ'},
    enabled: {mac: true, win: true, linux: true}
  },
  onetouchultramini: {
    instructions: 'Plug in meter with cable and make sure the meter is switched off',
    name: 'OneTouch UltraMini',
    key: 'onetouchultramini',
    source: {type: 'device', driverId: 'OneTouchUltraMini'},
    enabled: {mac: true, win: true, linux: true}
  },
  onetouchultra2: {
    instructions: 'Plug in meter with cable and make sure the meter is switched off',
    name: 'OneTouch Ultra 2',
    key: 'onetouchultra2',
    source: {type: 'device', driverId: 'OneTouchUltra2'},
    enabled: {mac: true, win: true, linux: true}
  },
  truemetrix: {
    instructions: 'True Metrix & True Metrix Air: Place meter in cradle \u2022 True Metrix Go: Plug in meter with micro-USB cable',
    name: 'Trividia Health True Metrix',
    key: 'truemetrix',
    source: {type: 'device', driverId: 'TrueMetrix'},
    enabled: {mac: true, win: true, linux: true}
  }
};

export default devices;
