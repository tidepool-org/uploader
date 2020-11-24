/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2019, Tidepool Project
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 *
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

import _ from 'lodash';
import sundial from 'sundial';

import crypto from 'crypto';
import TZOUtil from '../../TimezoneOffsetUtil';
import UsbDevice from '../../usbDevice';
import {
  CRC8,
  packFrame,
  unpackFrame,
  uintFromArrayBuffer,
  formatString,
} from './utils';

const { promisify } = require('util');

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('WeitaiUSBDriver') : console.log;

const usb = require('usb')

class WeitaiUSB {
  constructor(cfg) {
    this.cfg = cfg;
  }

  static get TIMEOUT() {
    return 5000;
  }

  async openDevice(deviceInfo, cb) {
    this.usbDevice = new UsbDevice(deviceInfo);
    try{
      this.usbDevice.device.open(false); // don't auto-configure
    }catch(err){
      return cb({code:'E_SERIAL_CONNECTION'}, null);
    }
    this.usbDevice.device.reset(() => { debug('USB:reset') });
    this.usbDevice.device.setConfiguration(1, async () => {
      if (this.usbDevice.device.interfaces == null) {
        return cb({code:'E_UNPLUG_AND_RETRY'}, null);
        // throw new Error('Please unplug device and retry.');
      }

      // debug('deviceInfo');
      // debug(deviceInfo.vendorId);
      // debug(deviceInfo.productId);

      if (deviceInfo.vendorId == 6353 && deviceInfo.productId == 11521) {
        await this.open18d1(cb)
      } else {
        //set change
        this.usbDevice.iface = this.usbDevice.device.interfaces[3];
        this.usbDevice.iface.claim();
        this.usbDevice.iface.endpoints[0].timeout = WeitaiUSB.TIMEOUT;
        
        //start change

        try {
          // 2B2B05010245100000002B2BD41D8CD98F00B204E9800998ECF8427E
          const getStatus = {
            requestType: 'vendor',
            recipient: 'device',
            request: 0x33,
            value: 0x00,
            index: 0x00,
          };
  
          const incoming_control = await this.usbDevice.controlTransferIn(getStatus, 2);
          // debug('Received association request:', _.toUpper(incoming_control.toString('hex')));
          
          //AOA版本号
          if (incoming_control.toString('hex') != '0200') {
            return cb({code:'E_SERIAL_CONNECTION'}, null);
          }
  
          const getStatus1 = {
            requestType: 'vendor',
            recipient: 'device',
            request: 0x34,
            value: 0x00,
            index: 0x00,
          };
  
          var buff1 = new Buffer("MicrotechMD\0");
          // debug('Send AOA request:', _.toUpper(buff1.toString('hex')));
          await this.usbDevice.controlTransferOut(getStatus1, buff1);
  
          const getStatus2 = {
            requestType: 'vendor',
            recipient: 'device',
            request: 0x34,
            value: 0x00,
            index: 0x01,
          };
  
          var buff2 = new Buffer("Equil\0");
          await this.usbDevice.controlTransferOut(getStatus2, buff2);
  
  
          const getStatus3 = {
            requestType: 'vendor',
            recipient: 'device',
            request: 0x34,
            value: 0x00,
            index: 0x03,
          };
  
          var buff3 = new Buffer("1.0\0");
          await this.usbDevice.controlTransferOut(getStatus3, buff3);
  
  
          const getStatus4 = {
            requestType: 'vendor',
            recipient: 'device',
            request: 0x35,
            value: 0x00,
            index: 0x00,
          };
  
          await this.usbDevice.controlTransferOut(getStatus4, Buffer.alloc(0));
          this.usbDevice.device.close(false); // don't auto-configure
          setTimeout(() => {
            deviceInfo.vendorId = 6353;
            deviceInfo.productId = 11521;
            this.openDevice(deviceInfo,cb)
          }, 3000);
        } catch (error) {
          if (error.message === 'LIBUSB_TRANSFER_TIMED_OUT') {
            error.code = 'E_UNPLUG_AND_RETRY';
          }
          return cb(error, null);
        }
      }
    });
  }

  async open18d1(cb){
    debug('in Accessory Mode!');
    [this.usbDevice.iface] = this.usbDevice.device.interfaces;
    this.usbDevice.iface.claim();

    this.usbDevice.iface.endpoints[0].transferType = usb.LIBUSB_TRANSFER_TYPE_BULK;
    this.usbDevice.iface.endpoints[1].transferType = usb.LIBUSB_TRANSFER_TYPE_BULK;
    this.usbDevice.iface.endpoints[0].timeout = WeitaiUSB.TIMEOUT;
    this.usbDevice.iface.endpoints[1].timeout = WeitaiUSB.TIMEOUT;


    [this.inEndpoint, this.outEndpoint] = this.usbDevice.iface.endpoints;
    return cb(null);
  }

  //Weitai
  static buildPacket(payload) {

    const md5 = crypto.createHash('md5').update(payload).digest();
    const data = Buffer.concat([payload, md5], payload.length + md5.length);

    const commandBody = Buffer.alloc(8);

    commandBody.writeUInt8(0x05, 0); //Port
    commandBody.writeUInt8(0x01, 1); //Parameter
    commandBody.writeUInt8(0x02, 2); //Operation
    commandBody.writeUInt32LE(data.length, 4); //Length

    const crc8 = CRC8(Buffer.concat([commandBody.slice(0, 3), commandBody.slice(4)], commandBody.length - 1));
    commandBody.writeUInt8(crc8, 3); //Checksum_CRC8

    const command = new Buffer(packFrame(commandBody));

    const packet = Buffer.concat([command, data], command.length + data.length);

    return packet;
  }  

  // Weitai
  static parsePacket(packet,cfg) {

    const command = WeitaiUSB.getCommand(packet);

    if (command.length < 12) {
      //command 长度校验不通过
      return false;
    }
    const commandBody = new Buffer(unpackFrame(command));

    const port = commandBody[0];
    const parameter = commandBody[1];
    const operation = commandBody[2];
    const crc8 = commandBody[3];
    const length = commandBody.readInt32LE(4);

    const crc8_c = CRC8(Buffer.concat([commandBody.slice(0, 3), commandBody.slice(4)], commandBody.length - 1));

    if (crc8 != crc8_c) {
      //CRC8校验不通过
      return cb({code:'E_READ_FILE'}, null);
    }

    if (packet.length < command.length + length) {
      //长度校验不通过
      return cb({code:'E_READ_FILE'}, null);
    }

    const data = packet.slice(command.length, command.length + length);

    const payload = data.slice(0, data.length - 16);
    const md5 = data.slice(data.length - 16, data.length);

    const md5_c = crypto.createHash('md5').update(payload).digest();

    if (!md5.equals(md5_c)) {
      //md5校验不通过
      return cb({code:'E_READ_FILE'}, null);
    }

    let inComeRes = WeitaiUSB.parsePayload(payload,cfg);


    return inComeRes;
  }

  static parsePayload(payload,cfg) {
    //每22字节为一条数据

    if (payload.length == 0) {
      // 无数据
      return cb({code:'E_READ_FILE'}, null);
    }

    if (payload.length % 22) {
      //数据异常，非22的倍数
      return cb({code:'E_READ_FILE'}, null);
    }

    let inComeRes = {
      BloodGlucoses:[],
      BasalRates:[],
      BolusRates:[],
      lastBasals:[]
    };

    for (let i = 0; i < payload.length; i += 22) {
      const history = payload.slice(i, i + 22);

      const ID = history.slice(0, 4);
      const dateTime = history.slice(4, 10);
      const status = history.slice(10, 16);
      const event = history.slice(16, 22);

      const recordID = uintFromArrayBuffer(ID, true);

      const year = uintFromArrayBuffer(dateTime.slice(0, 1), true) + 2000;
      const month = uintFromArrayBuffer(dateTime.slice(1, 2), true);
      const day = uintFromArrayBuffer(dateTime.slice(2, 3), true);
      const hour = uintFromArrayBuffer(dateTime.slice(3, 4), true);
      const minute = uintFromArrayBuffer(dateTime.slice(4, 5), true);
      const second = uintFromArrayBuffer(dateTime.slice(5, 6), true);

      const battery = uintFromArrayBuffer(status.slice(0, 1), true);
      const reservoir = uintFromArrayBuffer(status.slice(1, 2), true);
      const basalRate = uintFromArrayBuffer(status.slice(2, 4), true);
      const bolusRate = uintFromArrayBuffer(status.slice(4, 6), true);

      const eventIndex = uintFromArrayBuffer(event.slice(0, 2), true);
      const eventPort = uintFromArrayBuffer(event.slice(2, 3), true);
      const eventType = uintFromArrayBuffer(event.slice(3, 4), true);
      const eventUrgency = uintFromArrayBuffer(event.slice(4, 5), true);
      const eventValue = uintFromArrayBuffer(event.slice(5, 6), true);

      const timeText = year + '-' + (month + 100).toString().substring(1) + '-' + (day + 100).toString().substring(1) + ' '
        + (hour + 100).toString().substring(1) + ':' + (minute + 100).toString().substring(1) + ':' + (second + 100).toString().substring(1);
      let recoder = {
        deviceTime:timeText,
        recordId:recordID,
        eventPort
      };

      if(cfg.lastUpload && new Date(timeText).valueOf() < cfg.lastUpload){
        if(eventPort != 3 && basalRate){
          recoder.BasalRate = parseInt(formatString(basalRate.toString(), 4, true))*0.00625;
          inComeRes.lastBasals.push(recoder)
        }
        continue;
      }
      //BloodGlucose
      if(eventPort == 3 && eventType == 0) {
        recoder.BloodGlucose = formatString(basalRate.toString(), 4, true);
        inComeRes.BloodGlucoses.push(recoder);
        continue;
      }

      //Carbohydrate
      if(eventPort == 3 && eventType == 1) {continue;}

      //Basal
      if(eventPort != 3 && basalRate){
        recoder.BasalRate = parseInt(formatString(basalRate.toString(), 4, true))*0.00625;
        inComeRes.BasalRates.push(recoder);
      }

      //BolusRate
      if(parseInt(formatString(bolusRate.toString(), 6, true))  == 0){
        if(inComeRes.BolusRates[inComeRes.BolusRates.length-1] && parseInt(inComeRes.BolusRates[inComeRes.BolusRates.length-1].BolusRate) != 0){ // last not 0 
          recoder.BolusRate = formatString(bolusRate.toString(), 6, true);
          inComeRes.BolusRates.push(recoder);
        }else{
          if(!inComeRes.BolusRates.length){
            recoder.BolusRate = formatString(bolusRate.toString(), 6, true);
            inComeRes.BolusRates.push(recoder);
          }
        }
      }
      if(parseInt(formatString(bolusRate.toString(), 6, true)) != 0){
        recoder.BolusRate = formatString(bolusRate.toString(), 6, true);
        inComeRes.BolusRates.push(recoder);
      }



      const text1 = (recordID + 1000).toString().substring(1);
      const text2 = year + '-' + (month + 100).toString().substring(1) + '-' + (day + 100).toString().substring(1) + ' '
        + (hour + 100).toString().substring(1) + ':' + (minute + 100).toString().substring(1) + ':' + (second + 100).toString().substring(1);

      const text3 = ' Battery/Flag: ' + formatString(battery.toString(), 3, true)
        + ' Reservoir/Type: ' + formatString(reservoir.toString(), 3, true)
        + ' BasalRate/BloodGlucose: ' + formatString(basalRate.toString(), 4, true)
        + ' BolusRate/Carbohydrate: ' + formatString(bolusRate.toString(), 6, true)

        const text4 = ' EventIndex: ' + formatString(eventIndex.toString(), 4, true)
        + ' EventPort: ' + eventPort
        + ' EventType: ' + eventType
        + ' EventUrgency: ' + eventUrgency
        + ' EventValue: ' + eventValue;

      // debug(text1, text2, text3, text4);

    }
    // debug('解析结果',inComeRes)
    if(inComeRes.lastBasals.length){
      //time sort
      inComeRes.lastBasals.sort(function(a,b){
        return a.deviceTime < b.deviceTime ? -1 : 1
      });
      inComeRes.BasalRates.unshift(inComeRes.lastBasals[inComeRes.lastBasals.length-1]);
    }
    return inComeRes;
  }

  static getCommand(buffer) {
    var begin = -1;
    var end = -1;
    for (var i = 0; i < buffer.length - 1; ++i) {
      if (begin < 0) {
        const c1 = buffer[i];
        const c2 = buffer[i + 1];
        if (c1 == 0x2B && c2 == 0x2B) {
          begin = i;
          i++;
        }
      }
      else {
        const c1 = buffer[i];
        const c2 = buffer[i + 1];
        if (c1 == 0x2B && c2 == 0x2B) {
          end = i + 1;
          break;
        }
      }
    }
    if (begin < 0 || end < 0) {
      return Buffer.alloc(0);
    }
    return buffer.slice(begin, end + 1);
  }
  

  async getConfig(data) {
     //start
    //  const buffer = Buffer.alloc(28);
    let done = false;
     const buffer = WeitaiUSB.buildPacket(Buffer.alloc(0));
     await this.usbDevice.transferOut(this.outEndpoint.address, buffer);
     var incomingA = Buffer.alloc(0);
     while(!done){
      await this.usbDevice.transferIn(this.inEndpoint.address, 1024)
      .then((res)=>{
        const incoming = res;
        incomingA = Buffer.concat([incomingA, incoming], incomingA.length + incoming.length);
        // debug('Received', _.toUpper(incoming.toString('hex')));
      }).catch((err)=>{
        done = true;
      })
     };
     const getMostRecentUpload = promisify(this.cfg.api.getMostRecentUploadRecord);
     const res =  await getMostRecentUpload(this.cfg.groupId, 'unkown');
     debug('lastUpload','start');
     if(res && res.time){
       this.cfg.lastUpload = new Date(res.time).valueOf();
       debug('lastUpload',this.cfg.lastUpload);
      }else{
        this.cfg.lastUpload = 0;
      }
     data.incomingA = incomingA;
     return data;
  }

  async release(cb) {
    // return cb();
  }


  async close(cb) {
    try{
      this.usbDevice.iface.release(true, () => {
        this.usbDevice.device.close();
        cb();
      });
    }catch(err){
      return cb({code:'E_SERIAL_CONNECTION'}, null);
    }
  }
}

module.exports = (config) => {
  const cfg = _.clone(config);
  _.assign(cfg.deviceInfo, {
    tags: ['bgm'],
    manufacturers: ['Weitai'],
  });
  const driver = new WeitaiUSB(cfg);

  // With no date & time settings changes available,
  // timezone is applied across-the-board
  cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []);

  return {
    /* eslint no-param-reassign:
       [ "error", { "props": true, "ignorePropertyModificationsFor": ["data"] } ] */

    detect(deviceInfo, cb) {
      debug('no detect function needed', deviceInfo);
      cb(null, deviceInfo);
    },

    setup(deviceInfo, progress, cb) {
      debug('in setup!');
      progress(100);
      cb(null, { deviceInfo });
    },

    connect(progress, data, cb) {
      debug('in connect!');
      driver.openDevice(data.deviceInfo, (err) => {
        if (err) {
          data.disconnect = true;
          debug('Error:', err);
          return cb(err, null);
        }
        return cb(null, data);
      });
    },

    getConfigInfo(progress, data, cb) {
      debug('in getConfigInfo', data);
      progress(0);
      let _this = this;
      (async () => {
        //start
        const result = await driver.getConfig(data);
        data.deviceDetails = result;
        cb(null, data);
      })().catch((error) => {
        debug('Error in getConfigInfo: ', error);
        cb(error, null);
      });
    },

      
    buildBlood(BloodGlucoses){
      let res =[];
      for(let blood of BloodGlucoses){
        if(new Date(blood.deviceTime).valueOf() < cfg.lastUpload){
          continue;
        };
        const recordBuilder = cfg.builder.makeSMBG()
        .with_value(parseFloat(blood.BloodGlucose))
        .with_units('mg/dL') // values are always in 'mg/dL'
        .with_deviceTime(sundial.formatDeviceTime(new Date(blood.deviceTime).valueOf()))
        .set('index', blood.recordId);

        cfg.tzoUtil.fillInUTCInfo(recordBuilder, new Date(blood.deviceTime).valueOf());
        const postRecord = recordBuilder.done();
        delete postRecord.index;
        postRecord.deviceId = 'MTM-I';
        res.push(postRecord);
      }
      return res;
    },

    buildBasal(BasalRates){
      let res = [];
      
      //date sort desc
      BasalRates.sort(function(a,b){
        return a.deviceTime < b.deviceTime ? -1 : 1
      });
      //today
      // BasalRates = BasalRates.filter((a)=>{ return a.deviceTime > '2020-07-20 23:59:59' && a.deviceTime < '2020-07-22 00:00:00'})
      for (let i = 0; i < BasalRates.length; i++) {
        let currDu = new Date(BasalRates[i].deviceTime).valueOf();
        let nextDu = BasalRates[i+1] ? new Date(BasalRates[i+1].deviceTime).valueOf() : currDu+1000;
        if((nextDu - currDu) < 0){
          debug('error-basal',BasalRates[i])
        }
        if(i == BasalRates.length-1 ){break;}
        let basalBuilder = cfg.builder.makeScheduledBasal()
        .with_scheduleName('currValue')
        .with_deviceTime(sundial.formatDeviceTime(new Date(BasalRates[i].deviceTime).valueOf()))
        .with_rate(1)
        // .with_rate(BasalRates[i].BasalRate)
        .with_duration((nextDu-currDu))
        .set('index', BasalRates[i].recordId);
        cfg.tzoUtil.fillInUTCInfo(basalBuilder, new Date(BasalRates[i].deviceTime).valueOf());
        const postRecord = basalBuilder.done();
        if(res[i-1]){
          let preRes = JSON.stringify(res[i-1]);
          preRes = JSON.parse(preRes);
          delete preRes.previous;
          postRecord.previous = preRes;
        }
        postRecord.deviceId = 'MTM-I';
        res.push(postRecord);
      }
      return res;
    },

    buildBolus(BolusRates){
      let postRes = [];
      let itemRes = [];
      for(let bolus of BolusRates){
        //itemRes.length is 0
        if(!itemRes.length){
          itemRes.push(bolus);
          continue;
        }
        //itemRes.length not 0
        if(bolus.BolusRate == '0' ){
          itemRes.push(bolus);
          let chckRes = this.checkBolus(itemRes);
          if(chckRes == 'normal' ){
            let postAary = this.buildBolusNormal(itemRes);
            postRes = postRes.concat(postAary);
          }
          if(chckRes == 'square'){
            let postAary = this.buildBolusSquare(itemRes);
            postRes = postRes.concat(postAary);
          }
          if(chckRes == 'dulSquare'){
            let postAary = this.buildBolusDualSquare(itemRes);
            postRes = postRes.concat(postAary);
          }
          itemRes = [];
          continue;
        }else{
          itemRes.push(bolus);
          continue;
        }
      }
      return postRes;
    },
    checkBolus(blous){
      let normal = false;
      let square = false;
      let returnStr = '';
      for(let item of blous){
        if(parseInt(item.BolusRate)>0 && parseInt(item.BolusRate)<=12800){
          square = true
        }
        if(parseInt(item.BolusRate) > 12800){
          normal = true;
        }
      }
      if(normal && square){
        returnStr = 'dulSquare'
      }
      if(normal && !square){
        returnStr = 'normal'
      }
      if(!normal && square){
        returnStr = 'square'
      }
      return returnStr;
    },
    buildBolusNormal(bolus){
      let bolusArray = [];
      for(let i=0;i<bolus.length;i++){
        if(bolus[i].BolusRate != '0'){
          let currTimeStamp = new Date(bolus[i].deviceTime).valueOf();
          let nextTimeStamp = bolus[i+1] ? new Date(bolus[i+1].deviceTime).valueOf() : new Date(bolus[i].deviceTime).valueOf();
          let durCalcut = (nextTimeStamp-currTimeStamp)/1000;
          let boluMount = this.buildValue(((parseInt(bolus[i].BolusRate) * 0.00625 * durCalcut) / (60 * 60)))
          let postbolus = cfg.builder.makeNormalBolus()
          .with_normal(boluMount)
          .with_deviceTime(sundial.formatDeviceTime(new Date(bolus[i].deviceTime).valueOf()))
          .set('index', bolus[i].recordId);
          cfg.tzoUtil.fillInUTCInfo(postbolus, new Date(bolus[i].deviceTime).valueOf());
          postbolus = postbolus.done();
          postbolus.deviceId = 'MTM-I';
          bolusArray.push(postbolus);
        }
      }
      return bolusArray;
    },

    buildBolusSquare(bolus){
      let bolusArray = [];
      for(let i=0;i<bolus.length;i++){
        if(bolus[i].BolusRate != '0'){
          let currTimeStamp = new Date(bolus[i].deviceTime).valueOf();
          let nextTimeStamp = bolus[i+1] ? new Date(bolus[i+1].deviceTime).valueOf() : new Date(bolus[i].deviceTime).valueOf();
          let durCalcut = (nextTimeStamp-currTimeStamp)/1000;
          let boluMount = this.buildValue(((parseInt(bolus[i].BolusRate) * 0.00625 * durCalcut) / (60 * 60)))
          let postbolus = cfg.builder.makeSquareBolus()
          .with_deviceTime(sundial.formatDeviceTime(new Date(bolus[i].deviceTime).valueOf()))
          .with_extended(boluMount)
          .with_duration(nextTimeStamp - currTimeStamp)
          .set('index', bolus[i].recordId); 
          cfg.tzoUtil.fillInUTCInfo(postbolus, new Date(bolus[i].deviceTime).valueOf());
          postbolus = postbolus.done();
          postbolus.deviceId = 'MTM-I';
          bolusArray.push(postbolus)
        }
      }
      return bolusArray;
    },

    buildBolusDualSquare(bolus){
      let bolusArray = [];
      let normal = 0;
      let square = 0;
      let dur = 0;
      let deviceTime;
      let index = 0;
      for(let i=0;i<bolus.length;i++){
        let currTimeStamp = new Date(bolus[i].deviceTime).valueOf();
        let nextTimeStamp = bolus[i+1] ? new Date(bolus[i+1].deviceTime).valueOf() : new Date(bolus[i].deviceTime).valueOf();
        let currDur = nextTimeStamp - currTimeStamp;
        let durCalcut = (nextTimeStamp-currTimeStamp)/1000;
        // if(bolus[i].deviceTime > '2020-07-21 12:00:00' && bolus[i].deviceTime < '2020-07-21 14:00:00'){
        //   debug('time',0)
        // }
        let boluMount = (parseInt(bolus[i].BolusRate) * 0.00625 * durCalcut) / (60 * 60)
        if(bolus[i].BolusRate != '0' && parseInt(bolus[i].BolusRate) > 12800){
          normal = boluMount + normal;
          deviceTime = bolus[i].deviceTime;
          index = bolus[i].recordId;
        }
        if(bolus[i].BolusRate != '0' && parseInt(bolus[i].BolusRate) < 12800){
          square = boluMount+square;
          dur = currDur+dur;
        }
      }
      let postbolus = cfg.builder.makeDualBolus()
      .with_normal(this.buildValue(normal))
      .with_deviceTime(sundial.formatDeviceTime(new Date(deviceTime).valueOf()))
      .with_extended(this.buildValue(square))
      .with_duration(dur)
      .set('index', index);
      cfg.tzoUtil.fillInUTCInfo(postbolus, new Date(deviceTime).valueOf());
      postbolus = postbolus.done();
      postbolus.deviceId = 'MTM-I';
      bolusArray.push(postbolus);
      return bolusArray;
    },

    buildValue(value){
      value = this.formatDecimal(value,2);
      let res =((value*1000)/25);
      // console.log(value);
      let floorRes = Math.floor(res);
      let floor = floorRes*25;
      if(res > floorRes) {
        floor = (floor + 25)/1000;
      }else{
        floor = floor/1000
      }
      return floor;
    },
    formatDecimal(num, decimal) {
      num = num.toString()
      let index = num.indexOf('.')
      if (index !== -1) {
          num = num.substring(0, decimal + index + 1)
      } else {
          num = num.substring(0)
      }
      return parseFloat(num).toFixed(decimal)
    },
    fetchData(progress, data, cb) {
      // debug('in fetchData', data);
      let records = [];
      let incomingA = data.incomingA;
      const inComeRes = WeitaiUSB.parsePacket(incomingA,cfg);  //inComeRes:{BloodGlucoses:[],BasalRates:[],BolusRates:[]}
      // records.push({})
      data.BloodGlucoses = inComeRes.BloodGlucoses;
      data.BasalRates = inComeRes.BasalRates;
      data.BolusRates = inComeRes.BolusRates;
      data.records = records;
      return cb(null, data);
    },

    processData(progress, data, cb) {
      progress(100);
      let testArray = [
        {
          deviceTime: "2020-07-22 01:30:00",
          recordId: 486,
          eventPort: 4,
          BasalRate: 0.5,
          BolusRate: "0"
        },
        {
          deviceTime: "2020-07-22 01:10:00",
          recordId: 487,
          eventPort: 4,
          BasalRate: 0.5,
          BolusRate: "8000"
        },
        {
          deviceTime: "2020-07-22 01:20:00",
          recordId: 488,
          eventPort: 4,
          BasalRate: 0.5,
          BolusRate: "0"
        },
        {
          deviceTime: "2020-07-22 02:20:00",
          recordId: 489,
          eventPort: 4,
          BasalRate: 0.5,
          BolusRate: "0"
        },
        {
          deviceTime: "2020-07-22 02:30:00",
          recordId: 490,
          eventPort: 4,
          BasalRate: 0.5,
          BolusRate: "28800"
        },
        {
          deviceTime: "2020-07-22 02:40:00",
          recordId: 491,
          eventPort: 4,
          BasalRate: 0.5,
          BolusRate: "0"
        },
        {
          deviceTime: "2020-07-22 03:40:00",
          recordId: 492,
          eventPort: 4,
          BasalRate: 0.5,
          BolusRate: "0"
        },
        {
          deviceTime: "2020-07-22 03:50:00",
          recordId: 493,
          eventPort: 4,
          BasalRate: 0.5,
          BolusRate: "28800"
        },
        {
          deviceTime: "2020-07-22 04:00:00",
          recordId: 494,
          eventPort: 4,
          BasalRate: 0.5,
          BolusRate: "320"
        },
        {
          deviceTime: "2020-07-22 04:10:00",
          recordId: 495,
          eventPort: 4,
          BasalRate: 0.5,
          BolusRate: "0"
        }
      ];
      let testBasal=[
        {
          deviceTime: "2020-07-22 10:00:00",
          recordId: 515,
          eventPort: 4,
          BasalRate: 0.5
        },
        {
          deviceTime: "2020-07-22 11:20:19",
          recordId: 516,
          eventPort: 4,
          BasalRate: 0.5,
          BolusRate: "28800"
        },
        {
          deviceTime: "2020-07-22 11:30:53",
          recordId: 517,
          eventPort: 4,
          BasalRate: 0.5,
          BolusRate: "0"
        },
        {
          deviceTime: "2020-07-22 12:00:00",
          recordId: 518,
          eventPort: 4,
          BasalRate: 1.5
        }
      ];
      let bloodRes = this.buildBlood(data.BloodGlucoses);
      let basalRes = this.buildBasal(data.BasalRates);
      // let basalRes = this.buildBasal(testBasal);
      let bolusRes = this.buildBolus(data.BolusRates);
      // let bolusRes = this.buildBolus(testArray);
      basalRes = basalRes.length > 1 ? basalRes:[];
      let post_records = [].concat(bloodRes,basalRes,bolusRes);
      if(!post_records.length){
        return cb({code:'E_WEITAI_NO_UPLOAD'}, data);
      }
      data.post_records = post_records;
      return cb(null, data);
    },

    uploadData(progress, data, cb) {
      progress(0);
      const sessionInfo = {
        delta: cfg.delta,
        deviceTags: cfg.deviceInfo.tags,
        // deviceManufacturers: cfg.deviceInfo.manufacturers,
        // deviceModel: cfg.deviceInfo.model,
        deviceManufacturers: ['Weitai'],
        deviceModel: 'weitaiupload',
        deviceSerialNumber: cfg.deviceInfo.serialNumber || 'sdsdgdfdg',
        deviceId: cfg.deviceInfo.deviceId || 'unkown',
        start: sundial.utcDateString(),
        timeProcessing: cfg.tzoUtil.type,
        tzName: cfg.timezone,
        version: cfg.version,
      };
      // return false;
      cfg.api.upload.toPlatform(
        data.post_records, sessionInfo, progress, cfg.groupId,
        (err, result) => {
          progress(100);

          if (err) {
            debug(err);
            debug(result);
            cb(err, data);
          }
          data.cleanup = true;
          return cb(null, data);
        }, 'jellyfish',
      );
    },
    disconnect(progress, data, cb) {
      debug('in disconnect');
      driver.release(() => {
        data.disconnect = true;
        progress(100);
        cb(null, data);
      });
      progress(100);
      cb(null, data);
    },

    cleanup(progress, data, cb) {
      debug('in cleanup');
      driver.close(() => {
        progress(100);
        data.cleanup = true;
        cb();
      });
    },
  };
};
