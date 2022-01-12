import os from 'os';

const driverManifests = {
  Medtronic: {
    mode: 'HID',
    usb: [
      { vendorId: 6777, productId: 25344 }, // Bayer Contour Next Link mmol/L
      { vendorId: 6777, productId: 25088 }, // Bayer Contour Next Link
    ],
  },
  Medtronic600: {
    mode: 'HID',
    usb: [
      { vendorId: 6777, productId: 25104 }, // Bayer Contour Next Link 2.4
    ],
  },
  InsuletOmniPod: {
    mode: 'block',
    usb: [
      { vendorId: 7734, productId: 2 }, // Eros PDM
      { vendorId: 3725, productId: 8221 }, // Dash PDM
    ],
  },
  Dexcom: {
    mode: 'serial',
    usb: [
      { vendorId: 8867, productId: 71, driver: 'cdc-acm' },
    ],
  },
  AbbottPrecisionXtra: {
    mode: 'serial',
    bitrate: 19200,
    usb: [
      { vendorId: 6753, productId: 13344, driver: 'tusb3410' },
    ],
  },
  Tandem: {
    mode: 'serial',
    bitrate: 921600,
    sendTimeout: 50,
    receiveTimeout: 50,
    usb: [
      { vendorId: 1155, productId: 22336, driver: 'cdc-acm' },
    ],
  },
  AbbottFreeStyleLite: {
    mode: 'serial',
    bitrate: 19200,
    usb: [
      { vendorId: 6753, productId: 13328, driver: 'tusb3410' }, // Abbott cable
      { vendorId: 1027, productId: 24577 }, // FTDI cable
    ],
  },
  AbbottFreeStyleLibre: {
    mode: 'HID',
    usb: [
      { vendorId: 6753, productId: 13904 }, // FreeStyle Libre
      { vendorId: 6753, productId: 13936 }, // FreeStyle Libre Pro
      { vendorId: 6753, productId: 14672 }, // FreeStyle Libre 2
    ],
  },
  AbbottFreeStyleNeo: {
    mode: 'HID',
    usb: [
      { vendorId: 6753, productId: 14416 }, // FreeStyle Optium Neo
    ],
  },
  BayerContourNext: {
    mode: 'HID',
    usb: [
      { vendorId: 6777, productId: 29520 }, // Bayer Contour Next
      { vendorId: 6777, productId: 29712 }, // Bayer Contour Next USB
      { vendorId: 6777, productId: 25088 }, // Bayer Contour Next Link
      { vendorId: 6777, productId: 25344 }, // Bayer Contour Next Link mmol/L
      { vendorId: 6777, productId: 25104 }, // Bayer Contour Next Link 2.4
      { vendorId: 6777, productId: 24578 }, // Bayer Contour USB
      { vendorId: 6777, productId: 30720 }, // Bayer Contour Next One
      { vendorId: 6777, productId: 30976 }, // Ascensia Contour Next
    ],
  },
  BayerContour: {
    mode: 'serial',
    usb: [
      { vendorId: 6777, productId: 24577, driver: 'ftdi' }, // Official Bayer cable
      { vendorId: 1027, productId: 24577, driver: 'ftdi' }, // FTDI cable
    ],
  },
  ContourPlusOne: {
    mode: 'HID',
    usb: [
      { vendorId: 6777, productId: 30720 }, // Ascensia Contour Plus One
    ],
  },
  Animas: {
    mode: 'serial',
    bitrate: 9600,
    ctsFlowControl: true,
    sendTimeout: 500,
    receiveTimeout: 500,
    usb: [
      { vendorId: 1659, productId: 8963, driver: 'pl2303' },
    ],
  },
  OneTouchVerio: {
    mode: os.platform() === 'linux' ? 'usb' : 'block',
    usb: [
      { vendorId: 10086, productId: 0 }, // Verio
      { vendorId: 10086, productId: 4 }, // Verio Flex
      { vendorId: 10086, productId: 12 }, // Verio Reflect
    ],
  },
  OneTouchVerioIQ: {
    mode: 'serial',
    bitrate: 38400,
    usb: [
      { vendorId: 4292, productId: 34215, driver: 'cp2102' },
    ],
  },
  OneTouchVerioBLE: {
    mode: 'bluetooth',
  },
  OneTouchUltraMini: {
    mode: 'serial',
    usb: [
      { vendorId: 1659, productId: 8963, driver: 'pl2303' }, // "official" Prolific cable
      { vendorId: 1027, productId: 24577 }, // FTDI cable
      { vendorId: 6790, productId: 29987 }, // CH340 cable
    ],
  },
  OneTouchUltra2: {
    mode: 'serial',
    bitrate: 9600,
    sendTimeout: 5000,
    receiveTimeout: 5000,
    usb: [
      { vendorId: 1659, productId: 8963, driver: 'pl2303' }, // "official" Prolific cable
      { vendorId: 1027, productId: 24577 }, // FTDI cable
      { vendorId: 6790, productId: 29987 }, // CH340 cable
    ],
  },
  TrueMetrix: {
    mode: 'HID',
    usb: [
      { vendorId: 8001, productId: 0 },
      { vendorId: 8001, productId: 3 },
    ],
  },
  AccuChekUSB: {
    mode: 'usb',
    usb: [
      { vendorId: 5946, productId: 8661 }, // Accu-Chek Guide
      { vendorId: 5946, productId: 8655 }, // Accu-Chek Aviva Connect
      { vendorId: 5946, productId: 8662 }, // Accu-chek Guide Me
    ],
  },
  BluetoothLE: {
    mode: 'bluetooth',
  },
  CareSens: {
    mode: 'HID',
    usb: [
      { vendorId: 4292, productId: 35378 },
    ],
  },
  ReliOnPremier: {
    mode: 'serial',
    usb: [
      { vendorId: 1027, productId: 24597, driver: 'ftdi' }, // FT230x
    ],
  },
  GlucocardShine: {
    mode: 'serial',
    usb: [
      { vendorId: 1027, productId: 24597, driver: 'ftdi' }, // FT230x
    ],
  },
  GlucocardExpression: {
    mode: 'serial',
    bitrate: 19200,
    usb: [
      { vendorId: 1659, productId: 8963, driver: 'pl2303' }, // "official" Prolific cable
    ],
  },
  GlucocardShineHID: {
    mode: 'HID',
    usb: [
      { vendorId: 1155, productId: 41355 }, // Shine Connex & Express
    ],
  },
  AbbottLibreView: {
    mode: 'block',
  },
};

export default driverManifests;