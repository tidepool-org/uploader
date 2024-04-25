import mm723Image from '../../images/MM723_CNL_combo@2x.jpg';
import mm600Image from '../../images/MM600_CNL_combo@2x.jpg';
import env from '../utils/env';

import { i18n } from '../utils/config.i18next';
const devices = {
  abbottfreestylelibre: {
    instructions: i18n.t('Plug in meter with micro-USB cable'),
    key: 'abbottfreestylelibre',
    name: 'Abbott FreeStyle Libre & Libre Pro',
    source: {type: 'device', driverId: 'AbbottFreeStyleLibre'},
    enabled: {linux: true, mac: true, win: true},
    powerOnlyWarning: true,
  },
  abbottfreestylelite: {
    instructions: i18n.t('Plug cable into meter and then connect cable to computer'),
    key: 'abbottfreestylelite',
    name: 'Abbott FreeStyle Lite & Freedom Lite',
    source: {type: 'device', driverId: 'AbbottFreeStyleLite'},
    enabled: {mac: true, win: true, linux: true}
  },
  abbottfreestyleneo: {
    instructions: i18n.t('Plug in meter with micro-USB cable'),
    key: 'abbottfreestyleneo',
    name: 'Abbott FreeStyle Precision/Optium Neo',
    source: {type: 'device', driverId: 'AbbottFreeStyleNeo'},
    enabled: {linux: true, mac: true, win: true},
    powerOnlyWarning: true,
  },
  abbottlibreview: {
    instructions: i18n.t('Select CSV file downloaded from LibreView'),
    key: 'abbottlibreview',
    name: 'Abbott LibreView',
    source: {type: 'block', driverId: 'AbbottLibreView', extension: '.csv'},
    enabled: {linux: true, mac: true, win: true},
  },
  precisionxtra: {
    instructions: i18n.t('Plug in meter with cable'),
    key: 'precisionxtra',
    name: 'Abbott Precision Xtra',
    source: {type: 'device', driverId: 'AbbottPrecisionXtra'},
    enabled: {mac: false, win: true, linux: true}
  },
  bayercontournext: {
    instructions: i18n.t('Plug meter into USB port'),
    key: 'bayercontournext',
    name: 'Ascensia (Bayer) Contour Next, Contour Next Link, Contour Next Link 2.4, Contour Next USB, Contour Next One, Contour USB or Contour Next GEN',
    source: {type: 'device', driverId: 'BayerContourNext'},
    enabled: {mac: true, win: true, linux: true}
  },
  bayercontour: {
    instructions: i18n.t('Plug in meter with cable and make sure meter is switched on'),
    key: 'bayercontour',
    name: 'Ascensia (Bayer) Contour Next EZ, Contour, Contour Link or Contour Plus',
    source: {type: 'device', driverId: 'BayerContour'},
    enabled: {mac: true, win: true, linux: true}
  },
  contourplus: {
    instructions: i18n.t('Plug in meter with micro-USB'),
    key: 'contourplus',
    name: 'Ascensia Contour Plus One/Blue',
    source: {type: 'device', driverId: 'ContourPlus'},
    enabled: {mac: true, win: true, linux: true}
  },
  caresens: {
    instructions: i18n.t('Plug in meter with cable and make sure the meter is switched on'),
    name: 'CareSens N Premier, Dual, N Plus BT, Pro & N (Model: GM505PAD)',
    key: 'caresens',
    source: {type: 'device', driverId: 'CareSens'},
    enabled: {mac: true, win: true, linux: true}
  },
  caresensble: {
    instructions: {
                    text: i18n.t('For uploading instructions,'),
                    linkText: i18n.t('visit our support site'),
                    link: 'https://support.tidepool.org/hc/en-us/articles/360035332972#h_01EDCWR70ZH3WMHY4RX3SC80NX',
                  },
    name: 'CareSens N Premier, Dual & N Plus BT (using Bluetooth)',
    key: 'caresensble',
    source: {type: 'device', driverId: 'BluetoothLE'},
    enabled: {mac: true, win: false, linux: true}
    // CareSens Bluetooth pairing is tricky; maybe better to wait for Uploader-in-Web
    // before enabling it in Windows with proper on-screen instructions
  },
  dexcom: {
    instructions: i18n.t('Plug in receiver with micro-USB'),
    key: 'dexcom',
    name: 'Dexcom',
    source: {type: 'device', driverId: 'Dexcom'},
    enabled: {mac: true, win: true, linux: true}
  },
  weitai: {
    instructions: 'Plug in PDA with micro-USB',
    name: 'Equil Insulin Patch/Micro Pump',
    key: 'weitai',
    source: {type: 'device', driverId: 'Weitai'},
    enabled: {mac: true, win: true, linux: true}
  },
  foracareble: {
    instructions: i18n.t('Hold Bluetooth switch on meter until Bluetooth indicator starts to flash'),
    key: 'foracareble',
    name: 'Fora TN\'G Voice (using Bluetooth)',
    source: {type: 'device', driverId: 'BluetoothLE'},
    enabled: {mac: true, win: true, linux: true}
  },
  glucocardexpression: {
    instructions: {
                    text: i18n.t('Plug in meter with cable and set meter to'),
                    linkText: i18n.t('PC Link Mode'),
                    link: 'https://support.tidepool.org/hc/en-us/articles/4402234174100',
                  },
    name: 'GLUCOCARD Expression',
    key: 'glucocardexpression',
    source: {type: 'device', driverId: 'GlucocardExpression'},
    enabled: {mac: true, win: true, linux: true}
  },
  glucocardshine: {
    instructions: i18n.t('Plug in meter with cable and make sure the meter is switched on'),
    name: 'GLUCOCARD Shine & Shine XL',
    key: 'glucocardshine',
    source: {type: 'device', driverId: 'GlucocardShine'},
    enabled: {mac: true, win: true, linux: true}
  },
  glucocardshinehid: {
    instructions: i18n.t('Make sure the meter is switched off and plug in with micro-USB cable'),
    name: 'GLUCOCARD Shine Connex & Shine Express',
    key: 'glucocardshinehid',
    source: {type: 'device', driverId: 'GlucocardShineHID'},
    enabled: {mac: true, win: true, linux: true}
  },
  glucocardvital: {
    instructions: i18n.t('Make sure the meter is switched off and plug in cable'),
    name: 'GLUCOCARD Vital',
    key: 'glucocardvital',
    source: {type: 'device', driverId: 'GlucocardVital'},
    enabled: {mac: true, win: true, linux: true}
  },
  glucorx: {
    instructions: [i18n.t('Nexus and HCT: Plug in meter with mini-USB cable'), i18n.t('Nexus Mini Ultra & Go: Plug in meter with strip port cable')],
    name: 'GlucoRx Nexus, Nexus Mini Ultra, Go & HCT',
    key: 'glucorx',
    source: {type: 'device', driverId: 'GlucoRx'},
    enabled: {mac: true, win: true, linux: true}
  },
  pogo: {
    instructions: 'Plug in meter with micro-USB',
    name: 'Intuity Medical POGO',
    key: 'pogo',
    source: {type: 'device', driverId: 'IntuityPOGO'},
    enabled: {mac: true, win: true, linux: true}
  },
  omnipod: {
    instructions: i18n.t('DASH PDM: Unlock. Plug into USB. Tap Export on PDM. Click Upload.'),
    key: 'omnipod',
    name: 'Insulet Omnipod DASH',
    source: {type: 'device', driverId: 'InsuletOmniPod', extension: '.ibf'},
    enabled: {mac: true, win: true, linux: true},
    powerOnlyWarning: true,
  },
  omnipoderos: {
    instructions: i18n.t('Plug into USB. Wait for Export to complete. Click Upload.'),
    key: 'omnipoderos',
    name: 'Insulet Omnipod Classic',
    source: {type: 'device', driverId: 'InsuletOmniPod', extension: '.ibf'},
    enabled: {mac: true, win: true, linux: true},
    powerOnlyWarning: true,
  },
  medtronic: {
    instructions: i18n.t('Connect your Contour Next Link to your computer'),
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
    instructions: i18n.t('Connect your Contour Next Link 2.4 to your computer'),
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
  onetouchselect: {
    instructions: i18n.t('Plug in meter with micro-USB cable and make sure Uploader Helper extension is installed'),
    name: 'OneTouch Select Plus Flex',
    key: 'onetouchselect',
    source: {type: 'device', driverId: 'OneTouchSelect'},
    enabled: {linux: false, mac: false, win: true},
    powerOnlyWarning: true,
  },
  onetouchverio: {
    instructions: i18n.t('Plug in meter with micro-USB cable and make sure Uploader Helper extension is installed'),
    name: 'OneTouch Verio, Verio Flex and Verio Reflect',
    key: 'onetouchverio',
    source: {type: 'device', driverId: 'OneTouchVerio'},
    enabled: {linux: false, mac: false, win: true},
    powerOnlyWarning: true,
  },
  onetouchverioble: {
    instructions: i18n.t('Turn meter on and make sure Bluetooth is switched on'),
    name: 'OneTouch Verio Flex, Verio Reflect & Select Plus Flex (with Bluetooth)',
    key: 'onetouchverioble',
    source: {type: 'device', driverId: 'OneTouchVerioBLE'},
    enabled: {mac: true, win: true, linux: true}
  },
  onetouchverioiq: {
    instructions: i18n.t('Plug in meter with mini-USB'),
    name: 'OneTouch VerioIQ',
    key: 'onetouchverioiq',
    source: {type: 'device', driverId: 'OneTouchVerioIQ'},
    enabled: {mac: true, win: true, linux: true},
    powerOnlyWarning: true,
  },
  onetouchultramini: {
    instructions: i18n.t('Plug in meter with cable and make sure the meter is switched off'),
    name: 'OneTouch UltraMini',
    key: 'onetouchultramini',
    source: {type: 'device', driverId: 'OneTouchUltraMini'},
    enabled: {mac: true, win: true, linux: true}
  },
  onetouchultra2: {
    instructions: i18n.t('Plug in meter with cable and make sure the meter is switched off'),
    name: 'OneTouch Ultra 2',
    key: 'onetouchultra2',
    source: {type: 'device', driverId: 'OneTouchUltra2'},
    enabled: {mac: true, win: true, linux: true}
  },
  relionplatinum: {
    instructions: i18n.t('Plug in meter with micro-USB cable'),
    name: 'ReliOn Platinum',
    key: 'relionplatinum',
    source: {type: 'device', driverId: 'ReliOnPlatinum'},
    enabled: {mac: true, win: true, linux: true},
    powerOnlyWarning: true,  // shows warning for power-only USB cables
  },
  relionpremier: {
    instructions: i18n.t('Plug in meter with cable and make sure the meter is switched on'),
    name: 'ReliOn Premier (BLU, Voice & Classic)',
    key: 'relionpremier',
    source: {type: 'device', driverId: 'ReliOnPremier'},
    enabled: {mac: true, win: true, linux: true}
  },
  relionprime: {
    instructions: i18n.t('Make sure meter is switched off before plugging in cable'),
    name: 'ReliOn Prime',
    key: 'relionprime',
    source: {type: 'device', driverId: 'ReliOnPrime'},
    enabled: {mac: true, win: true, linux: true},
  },
  accuchekusb: {
    instructions: i18n.t('Plug in meter with micro-USB cable'),
    name: 'Roche Accu-Chek Aviva Connect, Instant, Guide & Guide Me',
    key: 'accuchekusb',
    source: {type: 'device', driverId: 'AccuChekUSB'},
    enabled: {mac: true, win: true, linux: true},
    powerOnlyWarning: true,  // shows warning for power-only USB cables
  },
  tandem: {
    instructions: i18n.t('Plug in pump with micro-USB'),
    key: 'tandem',
    name: 'Tandem',
    source: {type: 'device', driverId: 'Tandem'},
    enabled: {mac: true, win: true, linux: true},
    powerOnlyWarning: true,
  },
  truemetrix: {
    instructions: i18n.t('True Metrix, True Metrix Pro & True Metrix Air: Place meter in cradle \u2022 True Metrix Go: Plug in meter with micro-USB cable'),
    name: 'Trividia Health True Metrix',
    key: 'truemetrix',
    source: {type: 'device', driverId: 'TrueMetrix'},
    enabled: {mac: true, win: true, linux: true}
  },
};

if (navigator.userAgentData.platform === 'macOS') {
  devices.abbottfreestylelite.instructions = {
    text: i18n.t('Plug in meter with'),
    linkText: i18n.t('EZSync002B cable'),
    link: 'https://purenitetech.com/product/ezsync002b/',
  };
}

if (env.electron) {
  devices.onetouchverio.enabled = {mac: true, win: true, linux:true};
  devices.onetouchverio.instructions = i18n.t('Plug in meter with micro-USB cable');
  devices.onetouchselect.enabled = {mac: true, win: true, linux:true};
  devices.onetouchselect.instructions = i18n.t('Plug in meter with micro-USB cable');
}

export default devices;

