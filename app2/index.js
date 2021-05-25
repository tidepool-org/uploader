import _ from 'lodash';
import device from '../lib/core/device';
import driverManifests from '../lib/core/driverManifests';
import api from '../lib/core/api';
import builder from '../lib/objectBuilder';

const button = document.getElementById('connect');
const login = document.getElementById('login');
const app = document.getElementById('app');

const driverId = 'BayerContourNext';
const driverManifest = _.get(driverManifests, driverId);

const filters = driverManifest.usb.map(({vendorId, productId}) => ({
  usbVendorId: vendorId,
  usbProductId: productId
}));

const options = {
  api,
  timezone: 'Europe/London',
  version: 'uploader web2',
  builder: builder(),
};

const config = {
  API_URL: 'https://qa2.development.tidepool.org',
  UPLOAD_URL: 'https://qa2.development.tidepool.org',
  DATA_URL: 'https://qa2.development.tidepool.org/dataservices',
  BLIP_URL: 'https://app-qa2.development.tidepool.org'
};

api.create({
  apiUrl: config.API_URL,
  uploadUrl: config.UPLOAD_URL,
  dataUrl: config.DATA_URL,
  version: 'uploader web2',
});

login.addEventListener('submit', (event) => {
  const username = login.elements['username'].value;
  const password = login.elements['password'].value;

  api.init(() => {
    api.user.login({
        username,
        password
      }, (error, loginData) => {
      if (error) {
        console.log(error);
      } else {
        options.targetId = loginData.userid;
        options.groupId = loginData.userid;

        login.setAttribute('hidden', '');
        app.removeAttribute('hidden');
      }
    });
  });

  event.preventDefault();
});


button.addEventListener('click', async() => {
  try {
    const existingPermissions = await navigator.hid.getDevices();

    for (let i = 0; i < existingPermissions.length; i++) {
      for (let j = 0; j < driverManifest.usb.length; j++) {
        if (driverManifest.usb[j].vendorId === existingPermissions[i].vendorId
          && driverManifest.usb[j].productId === existingPermissions[i].productId) {
            console.log('Device has already been granted permission');
            options.hidDevice = existingPermissions[i];
        }
      }
    }

    if (options.hidDevice == null) {
      [options.hidDevice] = await navigator.hid.requestDevice({ filters: filters });
    }

    if (options.hidDevice == null) {
      throw new Error('No device was selected.');
    }

    device.init(options, () => {
      device.detect(driverId, options, (error, deviceInfo) => {
        if (deviceInfo !== undefined) {
          console.log('deviceInfo: ', deviceInfo);
          options.deviceInfo = deviceInfo;
          device.upload(driverId, options, (error) => {
            if (error) {
              console.error(`Error: ${error}`);
            }
          });
        } else {
          console.error(`Error: ${error}`);
        }
      });
    });

  } catch (err) {
    console.log('Error:', err);
  }
});
