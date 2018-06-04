import mm723Image from '../../images/MM723_CNL_combo@2x.jpg';
import medtronic600PumpImage from '../../images/bayer_contour_next_link_24.jpg';

const devices = {
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
    instructions: 'Pair your Bayer Contour Next Link 2.4 with your Medtronic pump and connect to your computer',
    image: {
      'src': medtronic600PumpImage,
      'height': 52,
      'width': 143,
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
    instructions: 'Plug in PDM with mini-USB and choose .ibf file from PDM',
    key: 'omnipod',
    name: 'Insulet OmniPod',
    source: {type: 'block', driverId: 'InsuletOmniPod', extension: '.ibf'},
    enabled: {mac: true, win: true, linux: true}
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
    name: 'Abbott FreeStyle Lite & Freedom Lite',
    source: {type: 'device', driverId: 'AbbottFreeStyleLite'},
    enabled: {mac: false, win: true}
  },
  abbottfreestylelibre: {
    instructions: 'Plug in meter with micro-USB cable',
    key: 'abbottfreestylelibre',
    name: 'Abbott FreeStyle Libre',
    showDriverLink: {linux: false, mac: false, win: false},
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
    enabled: {mac: true, win: true}
  },
  onetouchverio: {
    instructions: 'Plug in meter with micro-USB',
    name: 'OneTouch Verio & Verio Flex',
    key: 'onetouchverio',
    source: {type: 'device', driverId: 'OneTouchVerio'},
    enabled: {linux: true, mac: true, win: false}
  },
  onetouchverioiq: {
    instructions: 'Plug in meter with mini-USB',
    name: 'OneTouch VerioIQ',
    key: 'onetouchverioiq',
    source: {type: 'device', driverId: 'OneTouchVerioIQ'},
    enabled: {mac: true, win: true}
  },
  onetouchultramini: {
    instructions: 'Plug in meter with cable and make sure the meter is switched off',
    name: 'OneTouch UltraMini',
    key: 'onetouchultramini',
    showDriverLink: {mac: true, win: true},
    source: {type: 'device', driverId: 'OneTouchUltraMini'},
    enabled: {mac: true, win: true}
  },
  onetouchultra2: {
    instructions: 'Plug in meter with cable and make sure the meter is switched off',
    name: 'OneTouch Ultra 2',
    key: 'onetouchultra2',
    showDriverLink: {mac: true, win: true},
    source: {type: 'device', driverId: 'OneTouchUltra2'},
    enabled: {mac: true, win: true}
  }
};

export default devices;
