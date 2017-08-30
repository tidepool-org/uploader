#!/usr/bin/env babel-node
/* eslint-disable no-console */

import usb from 'usb';

import crc from '../../../crc';

const intro = 'OTVerio CLI:';

const USB_VENDOR_ID = 0x2766;
const USB_PRODUCT_ID = 0x0000;
const VENDOR_IDENTIFICATION = Buffer.from('LifeScan\x00');
const USB_SIGNATURE = {
  RECEIVE: Buffer.from('USBS'),
  SEND: Buffer.from('USBC'),
};
const USB_BULK_BLOCKSIZE = 512;
const USB_INQUIRY_BLOCKSIZE = 96;
const USB_FLAGS_READ = 0x80;
const USB_FLAGS_WRITE = 0x00;
const STX = 0x02;
const ETX = 0x03;
const RESPONSE_OK = 0x06;
const CBD_OP_CODE = {
  INQUIRY: 0x12,
  WRITE_10: 0x2a,
  READ_10: 0x28,
};
const CBD_TRANSFER_LENGTH = 1;
const LBA_NUMBER = {
  GENERAL: 3,
  PARAMETER: 4,
};
const SERVICE_ID = 0x04;
const QUERY_TYPE = {
  serialNumber: 0x00,
  deviceModel: 0x01,
  softwareVersion: 0x02,
  unknown: 0x03,
  dateFormat: 0x04,
  timeFormat: 0x05,
  vendorUrl: 0x07,
  languages: 0x09,
};
const PARAMETER_TYPE = {
  timeFormat: 0x00,
  dateFormat: 0x02,
  displayUnit: 0x04,
};
const UNIT_OF_MEASURE = [
  'mg/dL',
  'mmol/L',
];
const TIMESTAMP_EPOCH = 946684800;

function openDevice() {
  const device = usb.findByIds(USB_VENDOR_ID, USB_PRODUCT_ID);
  if (device) {
    device.open();
    return device;
  }
  console.log(intro, 'openDevice: Failed to find USB device!');
  return process.exit();
}

function getEndpoints(device) {
  if (device.interfaces.length < 1) {
    console.log(intro, 'getEndpoints: No USB interface found!');
    process.exit();
  }
  const deviceInterface = device.interfaces[0];

  if (deviceInterface.isKernelDriverActive()) {
    deviceInterface.detachKernelDriver();
  }

  deviceInterface.claim();

  if (deviceInterface.endpoints.length < 2) {
    console.log(intro, 'getEndpoints: Interface does not have enough endpoints:',
      deviceInterface.endpoints.length, ' < 2');
    process.exit();
  }

  deviceInterface.endpoints[0].transferType = usb.LIBUSB_TRANSFER_TYPE_BULK;
  deviceInterface.endpoints[1].transferType = usb.LIBUSB_TRANSFER_TYPE_BULK;

  return [deviceInterface.endpoints[0], deviceInterface.endpoints[1]];
}

const [inEndpoint, outEndpoint] = getEndpoints(openDevice());

inEndpoint.addListener('error', (error) => {
  console.log(intro, 'inEndpoint.error:', error);
  process.exit();
});

inEndpoint.startPoll(1, USB_BULK_BLOCKSIZE);

let usbDataBuffer = Buffer.alloc(0);

function parseUsbLayer(data, callback) {
  if (data && data.length > USB_SIGNATURE.RECEIVE.length) {
    if (data.slice(0, USB_SIGNATURE.RECEIVE.length).equals(USB_SIGNATURE.RECEIVE)) {
      // end of transmission found

      // check status byte
      if (data[data.length - 1] !== 0) {
        console.log(intro, 'parseUsbLayer: Error code:', data[data.length - 1]);
      } else if (callback) {
        // copy reference to pass on
        const receivedData = usbDataBuffer;
        // start new buffer
        usbDataBuffer = Buffer.alloc(0);
        // pass reference to buffer
        callback(receivedData);
      }
    } else {
      // payload packet found, append to buffer
      usbDataBuffer = Buffer.concat([usbDataBuffer, data]);
    }
  }
}

function sendPacket(data) {
  console.log(intro, 'sendPacket: data:', data);
  outEndpoint.transfer(data, (err) => {
    if (err !== undefined) {
      console.log(intro, 'sendPacket: outEndpoint.error:', err);
      process.exit();
    }
  });
}

function requestResponse(usbPackets, callback) {
  inEndpoint.removeAllListeners('data');
  inEndpoint.addListener('data', data => parseUsbLayer(data, callback));
  usbPackets.forEach(usbPacketData => sendPacket(usbPacketData));
}

let usbMassStorageTag = 0;

function buildUsbPacket(dataTransferLength, flags, cbd) {
  const usbRequestData = Buffer.alloc(31);
  USB_SIGNATURE.SEND.copy(usbRequestData);
  usbMassStorageTag += 1;
  usbRequestData.writeUInt32LE(usbMassStorageTag, 4);
  usbRequestData.writeUInt32LE(dataTransferLength, 8);
  usbRequestData.writeUInt8(flags, 12);
  usbRequestData.writeUInt8(cbd.length, 14);
  cbd.copy(usbRequestData, 15);
  return usbRequestData;
}

function buildScsiCbd10(opCode, lbaNumber) {
  // event though USB data is little endian, the SCSI CBD uses big endian
  const cbd = Buffer.alloc(10);
  cbd.writeUInt8(opCode, 0);
  cbd.writeUInt32BE(lbaNumber, 2);
  cbd.writeUInt16BE(CBD_TRANSFER_LENGTH, 7);
  return cbd;
}

function sendScsiWrite10(lbaNumber, usbRequestData, callback) {
  const cbd = buildScsiCbd10(CBD_OP_CODE.WRITE_10, lbaNumber);
  const writeCommand = buildUsbPacket(USB_BULK_BLOCKSIZE, USB_FLAGS_WRITE, cbd);
  requestResponse([writeCommand, usbRequestData], callback);
}

function sendScsiRead10(lbaNumber, callback) {
  const cbd = buildScsiCbd10(CBD_OP_CODE.READ_10, lbaNumber);
  requestResponse([buildUsbPacket(USB_BULK_BLOCKSIZE, USB_FLAGS_READ, cbd)],
    (queryResponseData) => {
      callback(queryResponseData);
    });
}

function validateScsiVendorId(data) {
  console.log(intro, 'validateScsiVendorId:', data);
  const VENDOR_ID_OFFSET = 8;
  if (data.length === 36 &&
    data.slice(VENDOR_ID_OFFSET, VENDOR_ID_OFFSET + VENDOR_IDENTIFICATION.length)
      .equals(VENDOR_IDENTIFICATION)) {
    console.log(intro, 'validateScsiVendorId: Found vendor identification');
    return true;
  }
  console.log(intro, 'validateScsiVendorId: Vendor identification not found!');
  return false;
}

function buildScsiCbdInquiry(opCode) {
  // event though USB data is little endian, the SCSI CBD uses big endian
  const cbd = Buffer.alloc(10);
  cbd.writeUInt8(opCode, 0);
  cbd.writeUInt16BE(USB_INQUIRY_BLOCKSIZE, 7);
  return cbd;
}

function scsiInquiry(callback) {
  const cbd = buildScsiCbdInquiry(CBD_OP_CODE.INQUIRY);
  requestResponse([buildUsbPacket(USB_INQUIRY_BLOCKSIZE, USB_FLAGS_READ, cbd)],
    (inquiryResponseData) => {
      let error = null;
      if (!validateScsiVendorId(inquiryResponseData)) {
        error = new Error('Vendor identification not found');
      }
      callback(error);
    });
}

function parseApplicationLayer(data, callback) {
  // const serviceId = data[0];
  const responseCode = data[1];
  if (responseCode !== RESPONSE_OK) {
    console.log(intro, 'parseApplicationLayer: Invalid response code:', responseCode);
    return;
  }
  const commandData = data.slice(2);
  if (callback) {
    callback(commandData);
  }
}

function parseLinkLayer(data, callback) {
  console.log(intro, 'parseLinkLayer:', data);
  if (data.length !== USB_BULK_BLOCKSIZE) {
    console.log(intro, 'parseLinkLayer: Invalid data blocksize:', data.length);
    return;
  }
  if (data[0] !== STX) {
    console.log(intro, 'parseLinkLayer: Invalid start byte:', data[0]);
    return;
  }
  const length = data.readUInt16LE(1);
  if (data[length - 3] !== ETX) {
    console.log(intro, 'parseLinkLayer: Invalid end byte:', data[length - 3]);
    return;
  }
  const crc16 = data.readUInt16LE(length - 2);
  const calculatedCrc16 = crc.calcCRC_A(data.slice(0, length - 2), length - 2);
  if (crc16 !== calculatedCrc16) {
    console.log(intro, 'parseLinkLayer: CRC error:', crc16, '!=', calculatedCrc16);
    return;
  }
  const applicationData = data.slice(3, length - 3);
  callback(applicationData);
}

function retrieveData(lbaNumber, usbRequestData, callback) {
  sendScsiWrite10(lbaNumber, usbRequestData, () => {
    sendScsiRead10(lbaNumber, (linkResponseData) => {
      parseLinkLayer(linkResponseData, (applicationResponseData) => {
        parseApplicationLayer(applicationResponseData, (commandData) => {
          callback(commandData);
        });
      });
    });
  });
}

function buildLinkLayerFrame(applicationData) {
  const length = 3 + applicationData.length + 3;
  const data = Buffer.alloc(length);
  data[0] = STX;
  data.writeUInt16LE(length, 1);
  applicationData.copy(data, 3);
  data[length - 3] = ETX;
  const calculatedCrc16 = crc.calcCRC_A(data.slice(0, length - 2), length - 2);
  data.writeUInt16LE(calculatedCrc16, length - 2);
  return data;
}

function retrieveQueryData(queryType, callback) {
  const linkRequestData = Buffer.alloc(USB_BULK_BLOCKSIZE);
  const applicationData = Buffer.from([SERVICE_ID, 0xe6, 0x02, QUERY_TYPE[queryType]]);
  buildLinkLayerFrame(applicationData).copy(linkRequestData);
  retrieveData(LBA_NUMBER.GENERAL, linkRequestData, (commandData) => {
    const responseString = commandData.slice(0, commandData.length - 2).toString('utf16le');
    console.log(intro, 'parseQueryResponse:', queryType, ':', responseString);
    callback();
  });
}

function retrieveParameterData(parameterType, callback) {
  const linkRequestData = Buffer.alloc(USB_BULK_BLOCKSIZE);
  const applicationData = Buffer.from([SERVICE_ID, PARAMETER_TYPE[parameterType], 0x00]);
  buildLinkLayerFrame(applicationData).copy(linkRequestData);
  retrieveData(LBA_NUMBER.PARAMETER, linkRequestData, (commandData) => {
    let responseString;
    if (parameterType === 'displayUnit') {
      responseString = UNIT_OF_MEASURE[commandData.readUInt32LE()];
    } else {
      responseString = commandData.slice(0, commandData.length - 2).toString('utf16le');
    }
    console.log(intro, 'parseParameterResponse:', parameterType, ':', responseString);
    callback();
  });
}

function retrieveRecordCount(callback) {
  const linkRequestData = Buffer.alloc(USB_BULK_BLOCKSIZE);
  const applicationData = Buffer.from([SERVICE_ID, 0x27, 0x00]);
  buildLinkLayerFrame(applicationData).copy(linkRequestData);
  retrieveData(LBA_NUMBER.GENERAL, linkRequestData, (commandData) => {
    const recordCount = commandData.readUInt16LE();
    console.log(intro, 'retrieveRecordCount:', recordCount);
    callback(recordCount);
  });
}

function getDate(timestamp) {
  return new Date((TIMESTAMP_EPOCH + timestamp) * 1000);
}

function retrieveRecords(recordIndex, recordCount, callback) {
  const linkRequestData = Buffer.alloc(USB_BULK_BLOCKSIZE);
  const applicationData = Buffer.from([SERVICE_ID, 0x31, 0x02, 0x00, 0x00, 0x00]);
  applicationData.writeUInt16LE(recordIndex, 3);
  buildLinkLayerFrame(applicationData).copy(linkRequestData);
  retrieveData(LBA_NUMBER.GENERAL, linkRequestData, (commandData) => {
    const timestamp = commandData.readUInt32LE(5);
    const glucoseValueMgdl = commandData.readUInt32LE(9);
    console.log(intro, 'retrieveRecords:', getDate(timestamp), glucoseValueMgdl);
    if (recordIndex + 1 < recordCount) {
      retrieveRecords(recordIndex + 1, recordCount, callback);
    } else {
      callback();
    }
  });
}

scsiInquiry((error) => {
  if (error) {
    console.log(intro, 'ERROR:', error);
    process.exit(1);
  }
  retrieveQueryData('deviceModel', () => {
    retrieveParameterData('displayUnit', () => {
      retrieveRecordCount((recordCount) => {
        retrieveRecords(0, recordCount, () => {
          process.exit();
        });
      });
    });
  });
});
