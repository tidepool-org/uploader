/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
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

var _ = require('lodash');
var sundial = require('sundial');
var util = require('util');

var builder = require('./../objectBuilder.js');


var twentyFourHours = 24 * 60 * 60 * 1000;

function combineArguments(args){
  return _.assign.apply(_, [
    {}
  ].concat(Array.prototype.slice.call(args, 0)));
}

/**
 * Adds an annotation to an event.
 *
 * @param event the event
 * @param ann the opaque string code for the annotation to add, or the annotation object itself
 */
function annotateEvent(event, ann){
  if (event.annotations == null) {
    event.annotations = [];
  }

  var annotation = typeof(ann) === 'string' ? { code: ann } : ann;
  var exists = false;
  for (var i = 0; i < event.annotations.length; ++i) {
    if (_.isEqual(event.annotations[i], annotation)) {
      exists = true;
      break;
    }
  }

  if (!exists) {
    event.annotations.push(annotation);
  }

  return event;
}

/**
 * Computes the number of milliseconds after midnight on the date specified.
 *
 * @param dateTime DateTime object to figure out millis from
 * @returns {number} number of millis in current day
 */
function computeMillisInCurrentDay(e){
  return sundial.getMsFromMidnight(e.time, e.timezoneOffset);
}


/**
 * Creates a new "simulator" for Medtronic MiniMed CareLink data.  The simulator has methods for events like
 *
 * cbg(), smbg(), basal(), bolus(), settingsChange(), etc.
 *
 * This simulator exists as an abstraction over the Tidepool APIs.  It was written to simplify the conversion
 * of static, "retrospective" audit logs from devices into events understood by the Tidepool platform.
 *
 * On the input side, you have events extracted from a CareLink CSV.  They should be delivered to the simulator
 * in time order.
 *
 * Once all input activities are collected, the simulator will have accumulated events that the Tidepool Platform
 * will understand into a local "events" array.  You can retrieve the events by calling `getEvents()`
 *
 * @param config
 * @returns {*}
 */
exports.make = function(config){
  if (config == null) {
    config = {};
  }
  var defaults = config.defaults;
  var events = [];

  function addEvent(base, event){
    Object.keys(event).forEach(function(key){
      base.set(key, event[key]);
    });
    var retVal = base.done();
    events.push(retVal);
    return retVal;
  }

  var bob = builder();
  bob.setDefaults(defaults);

  var currSettings = null;
  var currBasal = null;
  var currStatus = null;
  var lgsStatus = null;
  var currTimestamp = null;
  var currSchedBasalSeqNum = null, lastSchedBasalSeqNum = null;

  function setCurrBasal(basal){
    currBasal = basal;
  }

  function setCurrStatus(status) {
    currStatus = status;
  }

  /**
   * Note: LGS = low-glucose suspend
   * Because LGS suspends and resumes are collections of suspend and resume events
   * (usually at least two of each, sometimes many more suspends), we track where
   * we are in the LGS suspend & resume process and use that information to determine
   * next steps in data processing in certain cases.
   */
  function setLgsStatus(status) {
    lgsStatus = status;
  }

  function ensureTimestamp(e){
    if (currTimestamp > e.time) {
      throw new Error(
        util.format('Timestamps must be in order.  Current timestamp was[%s], but got[%j]', currTimestamp, e)
      );
    }
    if (e.scheduleName != null) {
      lastSchedBasalSeqNum = currSchedBasalSeqNum;
      currSchedBasalSeqNum = e.uploadSeqNum;
    }
    currTimestamp = e.time;
    return e;
  }

  /**
   * Looks at the current basal and does various processing to make sure
   * it is ready to accept an event with the provided timestamp.
   *
   * This processing generally amounts to looking at the currently active basal
   * and all of its suppressed basals and figuring out if any of them would be
   * completed by the time that the provided timestamp were to occur.  If any of
   * them should be completed, then we go ahead and generate the expected events
   * given the assumption that they were completed.
   *
   * When this is done, the current basal and all of its suppressed basals
   * should have time and duration values such that the timestamp provided
   * falls between the start and end points.
   *
   * @param time the timestamp to push time forward to
   */
  function pushBasalClockForward(time){
    var timeMillis = Date.parse(time);

    /**
     * Processes the individual parts of a basal event, pushing one of them (the "soonest")
     * forward if it completes before the closed-over "time" value
     *
     * @param parts The "parts" of a basal, the parent and its "suppressed" children in an array
     * @returns {boolean} whether it is possible that the currBasal could still be processed
     */
    function processParts(parts){
      if (parts == null || !Array.isArray(parts) || parts.length < 1) {
        return false;
      }

      // Find the part that ends the soonest
      var doneIndex = 0;
      var doneTime = Date.parse(parts[doneIndex].time) + parts[doneIndex].duration;
      for (var i = 1; i < parts.length; ++i) {
        var partCompletion = Date.parse(parts[i].time) + parts[i].duration;
        if (partCompletion < doneTime) {
          doneIndex = i;
          doneTime = partCompletion;
        }
      }

      // If the "soonest" part completes before our next timestamp,
      // then we need to push the clock forward and adjust basals events
      // until we have only active events during our next timestamp
      if (doneTime < timeMillis) {
        switch (parts[doneIndex].deliveryType) {
          case 'suspend':
          case 'temp':
            parts.splice(doneIndex, 1);
            break;
          case 'scheduled':
            var sched = parts[doneIndex];

            // "Complete" the current part and either remove or replace it
            if (currSettings == null) {
              parts.splice(doneIndex, 1);
            } else {
              var currSchedule = currSettings.basalSchedules[currSettings.activeSchedule];
              var currScheduleName = currSettings.activeSchedule;
              // We trust the schedule reported on a `BasalProfileStart` event over
              // the schedule as found by looking up in the settings history
              // because we know the settings history is sometimes flawed
              if (currSettings.activeSchedule !== sched.scheduleName) {
                currSchedule = currSettings.basalSchedules[sched.scheduleName];
                currScheduleName = sched.scheduleName;
              }
              if (currSchedule == null || currSchedule.length === 0) {
                parts.splice(doneIndex, 1);
              } else {
                var millisInDay = computeMillisInCurrentDay({time: doneTime, timezoneOffset: sched.timezoneOffset});
                for (i = 0; i < currSchedule.length; ++i) {
                  if (currSchedule[i].start >= millisInDay) {
                    break;
                  }
                }

                var newTsMillis = doneTime - millisInDay;
                if (i === currSchedule.length) {
                  i = 0;
                  newTsMillis += twentyFourHours;
                } else {
                  newTsMillis += currSchedule[i].start;
                }

                var basalBuilder = bob.makeScheduledBasal()
                  .with_scheduleName(currScheduleName)
                  .with_time(new Date(newTsMillis).toISOString())
                  .with_timezoneOffset(sched.timezoneOffset)
                  .with_rate(currSchedule[i].rate)
                  .with_duration((i+1 === currSchedule.length ? twentyFourHours : currSchedule[i+1].start) - currSchedule[i].start)
                  .set('annotations', [{ code: 'carelink/basal/fabricated-from-schedule' }]);

                var lastEvent = events[events.length - 1];
                if (lastEvent != null && lastEvent.deviceId != null) {
                  basalBuilder.set('deviceId', lastEvent.deviceId);
                }

                parts[doneIndex] = basalBuilder.done();
              }
            }
            break;
          default:
            throw new Error('Unknown basal type[' + parts[doneIndex].type + ']');
        }

        if (parts.length <= 0) {
          currBasal = null;
          return false;
        }

        // Adjust the timestamps on the "primary" event.
        _.assign(
          parts[0],
          {
            time: new Date(doneTime).toISOString(),
            duration: parts[0].duration - (doneTime - Date.parse(parts[0].time))
          }
        );

        // Fix the rates on percentage temps
        for (i = parts.length - 2; i >= 0; --i) {
          if (parts[i].deliveryType === 'temp' && parts[i].percent != null && parts[i+1].rate != null) {
            parts[i].rate = parts[i].percent * parts[i+1].rate;
          }
        }

        // Rebuild the basal from the constituent parts
        ptr = parts[0];
        for (i = 1; i < parts.length; ++i) {
          ptr.suppressed = _.clone(parts[i]);
          ptr = ptr.suppressed;
        }
        parts[0].previous = _.omit(currBasal, 'previous');
        delete parts[0].deviceTime;
        currBasal = parts[0];

        events.push(currBasal);
        return true;
      }
      return false;
    }
    var parts = [];
    do {
      var ptr = currBasal;
      parts = [];
      while (ptr != null) {
        parts.push(_.omit(ptr, 'suppressed'));
        ptr = ptr.suppressed;
      }
    } while (processParts(parts));
  }

  return {
    /**
     * Report a scheduled basal event.
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into a scheduled basal event recorded by the simulator
     */
    basalScheduled: function(){
      var event = combineArguments(arguments);
      /**
       * Unlike during manual suspends and temp basals, CareLink continues to emit
       * `BasalProfileStart` events according to the current basal schedule
       * during an LGS. We are already handling these in our basal clock, so we just
       * push the clock forward and exit early when we come across one.
       */
      if (currStatus != null && currStatus.status === 'suspended' && (currStatus.payload && currStatus.payload.cause === 'low_glucose')) {
        ensureTimestamp(event);
        pushBasalClockForward(event.time);
        return;
      }
      // this is the case where our nextBasal generation in resume generates a `duplicate`
      // hence we end up not using it, except for plucking its `previous` out
      if (currBasal != null && currBasal.time >= event.time &&
        // allow two seconds between fabricated basal and real one
        (Date.parse(currBasal.time) - Date.parse(event.time)) <= 2000) {
        if (currStatus != null && currStatus.status === 'resumed' && currStatus.time >= event.time) {
          event.time = currStatus.time;
          event.previous = _.clone(currBasal.previous);
          currStatus = null;
          currBasal = null;
        }
      }
      else if (currBasal != null && currBasal.time < event.time) {
        if (currStatus != null) {
          // now for the case where we *need* our nextBasal (usually resumption of temp)
          if (currStatus.status === 'resumed' && currStatus.time < event.time) {
            var resumed = _.cloneDeep(currBasal);
            resumed.time = currStatus.time;
            resumed.deviceTime = currStatus.deviceTime;
            resumed.duration = Date.parse(event.time) - Date.parse(currStatus.time);
            events.push(resumed);

            currStatus = null;
            setCurrBasal(resumed);
          }
          // and the case where the new scheduled basal slightly precedes the temp
          // so we fabricate a resume and we'll catch it and use when the actual resume fires
          else if (currStatus.status === 'suspended') {
            var deviceMetaResume = {
              time: event.time,
              deviceTime: event.deviceTime,
              timezoneOffset: event.timezoneOffset,
              previous: _.clone(_.omit(currStatus, 'previous')),
              subType: 'status',
              status: 'resumed'
            };

            setCurrStatus(deviceMetaResume);
            currBasal.duration = Date.parse(event.time) - Date.parse(currBasal.time);
          }
        }
      }
      ensureTimestamp(event);
      pushBasalClockForward(event.time);

      var currSchedule = null;
      if (currSettings != null) {
        currSchedule = currSettings.basalSchedules[currSettings.activeSchedule];
      }

      if (currSchedule == null || currSchedule.length === 0) {
        if (event.duration == null) {
          event.duration = 0;
          annotateEvent(event, 'basal/unknown-duration');
          if (currBasal != null) {
            event.previous = _.omit(currBasal, 'previous');
          }
          currBasal = addEvent(bob.makeScheduledBasal(), _.omit(event, 'uploadSeqNum'));
          return;
        }
      } else {
        var millisInDay = computeMillisInCurrentDay(event);
        for (var i = currSchedule.length - 1; i >= 0; --i) {
          if (currSchedule[i].start <= millisInDay) {
            break;
          }
        }

        if (currSchedule[i].rate === event.rate) {
          event.duration = (i + 1 === currSchedule.length ? twentyFourHours : currSchedule[i + 1].start) - millisInDay;
        } else {
          if (event.duration == null) {
            event.duration = 0;
          }
          /**
           * At the moment, we track upload sequence number on scheduled basals
           * so that we can recognize and disregard scheduled basals that occur
           * in the wrong order because of changing the time settings on the pump
           * (due to change to/from Daylight Savings Time or travel).
           *
           * We have plans to read the changes to the pump's display time settings
           * and adjust the timestamps (and our sort of the data) before we feed
           * it to the simulator. After we do that, we can (and should) remove all
           * references to upload sequence numbers.
           */
          if (currSchedBasalSeqNum > lastSchedBasalSeqNum) {
            return;
          }
          annotateEvent(event, 'carelink/basal/off-schedule-rate');
        }
      }

      if (currBasal != null) {
        event.previous = _.omit(currBasal, 'previous');
      }

      // covers all cases where we *haven't* fabricated a resume event
      if (!(currStatus != null && currStatus.status === 'resumed')) {
        currBasal = addEvent(bob.makeScheduledBasal(), _.omit(event, 'uploadSeqNum'));
      }
      // if we *have* fabricated a resume event, we have to wait to add our basal to the events
      // until after we've finished building and added the resume
      // so we just hang onto the current basal instead
      else {
        var basalBuilder = bob.makeScheduledBasal();
        Object.keys(event).forEach(function(key){
          basalBuilder.set(key, event[key]);
        });
        setCurrBasal(basalBuilder.done());
      }
    },

    /**
     * Report a temp basal event.
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into a temp basal event recorded by the simulator
     */
    basalTemp: function(){
      var event = combineArguments(arguments);

      pushBasalClockForward(event.time);

      if (currBasal != null) {
        if (currBasal.annotations &&
          // TODO: don't just check for this annotation in the first annotation object
          // it could be anywhere!
          currBasal.annotations[0].code === 'carelink/basal/fabricated-from-suppressed') {
          /**
           * Here we clear out any lingering basal events that we fabricated but haven't
           * yet added to the events because we didn't know if they might be duplicates
           * of the data that CareLink sometimes provides after resumption from temp
           * or suspend.
           */
          delete currBasal.deviceTime;
          addEvent(bob.makeScheduledBasal(), currBasal);
          currStatus = null;
        }
        // omit twice so that we actually get different objects
        event.previous = _.omit(currBasal, 'previous');
        var suppressed = _.cloneDeep(_.omit(currBasal, 'previous'));
        event.suppressed = suppressed;

        if (event.percent != null) {
          event.rate = currBasal.rate * event.percent;
        }
      }

      currBasal = addEvent(bob.makeTempBasal(), event);
    },

    /**
     * Report a bolus event.  This method just takes a generic bolus event and dispatches to the
     * correct method based on the 'subType' in the arguments.
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into a bolus event recorded by the simulator
     */
    bolus: function(){
      var bolus = ensureTimestamp(combineArguments(arguments));
      switch (bolus.subType) {
        case 'dual/square':
          this.bolusDual(bolus);
          break;
        case 'normal':
          this.bolusNormal(bolus);
          break;
        case 'square':
          this.bolusSquare(bolus);
          break;
        default:
          throw new Error('Unknown bolus type[' + event.bolus.subType + ']');
      }
    },

    /**
     * Report a dual bolus event.
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into a dual/square bolus event recorded by the simulator
     */
    bolusDual: function(){
      addEvent(bob.makeDualBolus(), ensureTimestamp(combineArguments(arguments)));
    },

    /**
     * Report a normal bolus event.
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into a normal bolus event recorded by the simulator
     */
    bolusNormal: function(){
      addEvent(bob.makeNormalBolus(), ensureTimestamp(combineArguments(arguments)));
    },

    /**
     * Report a square bolus event.
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into a square bolus event recorded by the simulator
     */
    bolusSquare: function(){
      addEvent(bob.makeSquareBolus(), ensureTimestamp(combineArguments(arguments)));
    },

    /**
     * Report a cbg event.
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into a cbg event recorded by the simulator
     */
    cbg: function(){
      addEvent(bob.makeCBG(), ensureTimestamp(combineArguments(arguments)));
    },

    /**
     * Report a change to the device's date and time settings.
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into a deviceMeta event recorded by the simulator
     */
    changeDeviceTime: function() {
      var event = ensureTimestamp(combineArguments(arguments));
      var timeChange = bob.makeDeviceMetaTimeChange()
        .with_change({
          from: event.deviceTime,
          to: new Date(event.timestamp).toISOString().slice(0,-5),
          agent: 'manual'
        })
        .with_deviceTime(event.deviceTime)
        .with_time(event.time)
        .with_timezoneOffset(event.timezoneOffset)
        .with_payload({
          NEW_TIME: event.timestamp
        })
        .set('deviceId', event.deviceId)
        // TODO: delete after conclusion of Jaeb study
        .set('jaebPayload', event.jaebPayload)
        // TODO: end deletion
        .done();
      events.push(timeChange);
    },

    /**
     * Resumes basal and bolus delivery from a previous LGS suspend.
     * This is the case that will *not* resume a temp basal that would still have been in effect
     * (Cf. MiniMed 530G manual, p. 125: http://www.accessdata.fda.gov/cdrh_docs/pdf12/P120010c.pdf)
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into a suspend deviceMeta event recorded by the simulator
     */
    lgsAutoResume: function(){
      var event = ensureTimestamp(combineArguments(arguments));

      if (currBasal.deliveryType !== 'suspend') {
        return;
      }

      // build a resume event
      var deviceMetaResumeBuilder = bob.makeDeviceMetaResume()
        .with_time(event.time)
        .with_timezoneOffset(event.timezoneOffset)
        .with_deviceTime(event.deviceTime)
        .with_reason(event.reason)
        .with_payload(event.payload)
        // TODO: delete after conclusion of Jaeb study
        .set('jaebPayload', event.jaebPayload);
        // TODO: end deletion

      if (event.deviceId != null) {
        deviceMetaResumeBuilder.set('deviceId', event.deviceId);
      }

      if (currStatus != null) {
        deviceMetaResumeBuilder.with_previous(_.omit(currStatus, 'previous'));
      }

      var deviceMetaResume = deviceMetaResumeBuilder.done();
      setCurrStatus(deviceMetaResume);

      // before adding the resume to the events, adjust the duration of the currBasal
      // and push the basal clock forward to force emission of all sub-events
      // related to basal schedule changes changing the `suppressed` inside the suspend basal
      var eventMillis = Date.parse(event.time);
      currBasal.duration = eventMillis - Date.parse(currBasal.time);
      pushBasalClockForward(event.time);
      events.push(deviceMetaResume);

      var nextBasal = null;

      // fabricate a nextBasal from the currently active basal schedule, according to the settings history
      if (currSettings != null) {
        var currSchedule = currSettings.basalSchedules[currSettings.activeSchedule];
        if (currSchedule.length > 0) {
          var millisInDay = computeMillisInCurrentDay(event);
          for (var i = currSchedule.length - 1; i >= 0; --i) {
            if (currSchedule[i].start <= millisInDay) {
              break;
            }
          } 

          var basalBuilder = bob.makeScheduledBasal()
            .with_scheduleName(currSettings.activeSchedule)
            .with_time(event.time)
            .with_timezoneOffset(event.timezoneOffset)
            .with_rate(currSchedule[i].rate)
            .with_duration((i+1 >= currSchedule.length ? twentyFourHours : currSchedule[i+1].start) - millisInDay)
            .set('annotations', [{ code: 'carelink/basal/fabricated-from-schedule' }]);

          var lastEvent = events[events.length - 1];
          if (lastEvent != null && lastEvent.deviceId != null) {
            basalBuilder.set('deviceId', lastEvent.deviceId);
          }

          nextBasal = basalBuilder.done();
        }
        else {
          return;
        }
      }
      else {
        return;
      }

      if (nextBasal == null) {
        return;
      }

      nextBasal.previous = _.omit(currBasal, 'previous');
      // don't add the nextBasal to the events, just save it in currBasal
      setCurrBasal(nextBasal);
    },

    /**
     * Resumes basal and bolus delivery from an LGS suspend.
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into a suspend deviceMeta event recorded by the simulator
     */
    lgsResume: function(){
      var event = ensureTimestamp(combineArguments(arguments));

      if (currBasal.deliveryType !== 'suspend') {
        return;
      }

      // build a resume event
      var deviceMetaResumeBuilder = bob.makeDeviceMetaResume()
        .with_time(event.time)
        .with_timezoneOffset(event.timezoneOffset)
        .with_deviceTime(event.deviceTime)
        .with_reason(event.reason)
        .with_payload(event.payload)
        // TODO: delete after conclusion of Jaeb study
        .set('jaebPayload', event.jaebPayload);
        // TODO: end deletion

      if (event.deviceId != null) {
        deviceMetaResumeBuilder.set('deviceId', event.deviceId);
      }

      if (currStatus != null) {
        deviceMetaResumeBuilder.with_previous(_.omit(currStatus, 'previous'));
      }

      var deviceMetaResume = deviceMetaResumeBuilder.done();
      setCurrStatus(deviceMetaResume);
      setLgsStatus('user_restart_basal');

      // before adding the resume to the events, adjust the duration of the currBasal
      // and push the basal clock forward to force emission of all sub-events
      // related to basal schedule changes changing the `suppressed` inside the suspend basal
      var eventMillis = Date.parse(event.time);
      currBasal.duration = eventMillis - Date.parse(currBasal.time);
      pushBasalClockForward(event.time);
      events.push(deviceMetaResume);

      // fabricate a nextBasal from the basal that was suppressed by the suspend
      // TODO: omitting the payload is because of the jaebPayload and can likely
      // be safely deleted after the conclusion of the Jaeb study
      var nextBasal = _.cloneDeep(_.omit(currBasal.suppressed, 'payload'));
      if (nextBasal == null) {
        return;
      }
      annotateEvent(nextBasal, 'carelink/basal/fabricated-from-suppressed');

      if (nextBasal.duration != null) {
        nextBasal.duration -= eventMillis - Date.parse(nextBasal.time);
      }

      nextBasal.time = event.time;
      if (event.timezoneOffset != null) {
        nextBasal.timezoneOffset = event.timezoneOffset;
      }

      nextBasal.previous = _.omit(currBasal, 'previous');
      // don't add the nextBasal to the events, just save it in currBasal
      setCurrBasal(nextBasal);
    },

    /**
     * Resumes basal and bolus delivery from a previous suspend.
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into a suspend deviceMeta event recorded by the simulator
     */
    resume: function(){
      /**
       * Annoyingly, resuming from an LGS (low-glucose suspend) often, but not *always*
       * involves two events, one with the code `user_restart_basal`, then one with
       * `normal_pumping` (same as a resume from a manual suspend).
       *
       * In order to resume successfully from all LGS events, we always resume upon seeing
       * the *first* resume event, then exit early here (when there is a second resume event).
       */
      if (lgsStatus === 'user_restart_basal') {
        lgsStatus = null;
        return;
      }
      var event = ensureTimestamp(combineArguments(arguments));

      if (currBasal.deliveryType !== 'suspend') {
        if (currStatus != null && currStatus.status === 'resumed' &&
          // allow two seconds between fabricated resume and actual resume
          (Date.parse(event.time) - Date.parse(currStatus.time)) <= 2000) {
          /**
           * The only time we find ourselves in a resume event without a currBasal deliveryType
           * of `suspend` is when we got the new basal profile event before the resume event.
           * (Annoyingly, this happens at a guess ~50% of the time in the CareLink data.)
           *
           * If such a thing happened, we have a (fabricated) resume event waiting for us
           * in currStatus, so all we have to do is finish filling out its required fields,
           * add it to the events, and add the currBasal (which triggered fabrication of the resume)
           * as well, then exit early because we're done resuming.
           */
          currStatus.reason = event.reason;
          if (event.deviceId != null) {
            currStatus.deviceId = event.deviceId;
          }
          currStatus = addEvent(bob.makeDeviceMetaResume(), currStatus);

          if (currBasal.deliveryType === 'temp') {
            currBasal = addEvent(bob.makeTempBasal(), currBasal);
          }
          else {
            currBasal = addEvent(bob.makeScheduledBasal(), currBasal);
          }
          return;
        }
        else {
          return;
        }
      }

      // build a resume event
      var deviceMetaResumeBuilder = bob.makeDeviceMetaResume()
        .with_time(event.time)
        .with_timezoneOffset(event.timezoneOffset)
        .with_deviceTime(event.deviceTime)
        .with_reason(event.reason)
        // TODO: delete after conclusion of Jaeb study
        .set('jaebPayload', event.jaebPayload);
        // TODO: end deletion

      if (event.payload != null) {
        deviceMetaResumeBuilder.with_payload(event.payload);
      }

      if (event.deviceId != null) {
        deviceMetaResumeBuilder.set('deviceId', event.deviceId);
      }

      if (currStatus != null) {
        deviceMetaResumeBuilder.with_previous(_.omit(currStatus, 'previous'));
      }

      var deviceMetaResume = deviceMetaResumeBuilder.done();
      setCurrStatus(deviceMetaResume);

      // before adding the resume to the events, adjust the duration of the currBasal
      // and push the basal clock forward to force emission of all sub-events
      // related to basal schedule changes changing the `suppressed` inside the suspend basal
      var eventMillis = Date.parse(event.time);
      currBasal.duration = eventMillis - Date.parse(currBasal.time);
      pushBasalClockForward(event.time);
      events.push(deviceMetaResume);

      /**
       * When the basal a pump is resuming to after a suspend is a scheduled basal
       * the CareLink data almost always has an event timestamped at (or near) the resume
       * representing the return to the schedule.
       *
       * But the CareLink data *never* provides this if the resuming-to basal
       * is a temp basal.
       *
       * Our strategy is to *always* fabricate a nextBasal from the current suppressed basal,
       * but we don't add it to the events right away. Rather, we wait until the next scheduled
       * basal we come across and add it then (after pushing the basal clock forward to force
       * emission of any other necessary segments due to schedule changes).
       */
      // TODO: omitting the payload is because of the jaebPayload and can likely
      // be safely deleted after the conclusion of the Jaeb study
      var nextBasal = _.cloneDeep(_.omit(currBasal.suppressed, 'payload'));
      if (nextBasal == null) {
        return;
      }
      annotateEvent(nextBasal, 'carelink/basal/fabricated-from-suppressed');

      if (nextBasal.duration != null) {
        nextBasal.duration -= eventMillis - Date.parse(nextBasal.time);
      }

      nextBasal.time = event.time;
      if (event.timezoneOffset != null) {
        nextBasal.timezoneOffset = event.timezoneOffset;
      }

      nextBasal.previous = _.omit(currBasal, 'previous');
      // don't add the nextBasal to the events, just save it in currBasal
      setCurrBasal(nextBasal);
    },

    /**
     * Report a settings event.
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into a settings event recorded by the simulator
     */
    settings: function(){
      var event = ensureTimestamp(combineArguments(arguments));
      pushBasalClockForward(event.time);

      currSettings = addEvent(bob.makeSettings(), event);
      // generate basal event(s) according to the current schedule
      // if we're dealing with a *22 series pump
      if (currBasal == null && config.autoGenScheduleds) {
        var currSchedule = currSettings.basalSchedules[currSettings.activeSchedule];
        if (currSchedule == null) {
          return;
        }

        var millisInDay = computeMillisInCurrentDay(currSettings);
        for (var i = currSchedule.length - 1; i > 0; --i) {
          if (currSchedule[i].start <= millisInDay) {
            break;
          }
        }

        if (currSchedule.length === 0) {
          return;
        }

        var basalBuilder = bob.makeScheduledBasal()
          .with_scheduleName(currSettings.activeSchedule)
          .with_time(currSettings.time)
          .with_timezoneOffset(currSettings.timezoneOffset)
          .with_rate(currSchedule[i].rate)
          .with_duration((i+1 >= currSchedule.length ? twentyFourHours : currSchedule[i+1].start) - millisInDay)
          .set('annotations', [{ code: 'carelink/basal/fabricated-from-schedule' }]);

        var lastEvent = events[events.length - 1];
        if (lastEvent != null && lastEvent.deviceId != null) {
          basalBuilder.set('deviceId', lastEvent.deviceId);
        }

        var basal = basalBuilder.done();
        setCurrBasal(basal);
        events.push(basal);
      }
    },

    /**
     * Report an smbg event.
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into an smbg event recorded by the simulator
     */
    smbg: function(){
      addEvent(bob.makeSMBG(), ensureTimestamp(combineArguments(arguments)));
    },

    /**
     * Suspends basal and bolus delivery until a resume is seen
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into a suspend deviceMeta event recorded by the simulator
     */
    suspend: function(){
      var event = ensureTimestamp(combineArguments(arguments));
      // threshold suspends involve several (usually 3-4) suspend events in succession
      // we only care about the first, so if the currStatus is already `suspended`, we return early
      if (currStatus != null && currStatus.status === 'suspended' && (event.payload && event.payload.cause === 'low_glucose')) {
        return;
      }
      /** This `if` block is designed for a very specific case:
       * a user has a long temp basals scheduled, and an LGS suspend interrupts it
       * but the user cancels the LGS, then the LGS first again within the duration of the original
       * temp, which means that there are no scheduled basal events to force emission of the
       * nextBasal event fabricated in simulator.resume, so we have to catch this event on the next
       * LGS and add it to the events then.
       */
      if (currBasal != null && currBasal.previous && currBasal.previous.deliveryType === 'suspend') {
        if (currBasal.deliveryType === 'temp') {
          addEvent(bob.makeTempBasal(), currBasal);
        }
        else {
          addEvent(bob.makeScheduledBasal(), currBasal);
        }
      }

      // build a suspend event
      var deviceMetaSuspendBuilder = bob.makeDeviceMetaSuspend()
        .with_time(event.time)
        .with_timezoneOffset(event.timezoneOffset)
        .with_deviceTime(event.deviceTime)
        .with_reason(event.reason)
        // TODO: delete after conclusion of Jaeb study
        .set('jaebPayload', event.jaebPayload);
        // TODO: end deletion

      if (event.payload != null) {
        deviceMetaSuspendBuilder.with_payload(event.payload);
      }

      if (event.deviceId != null) {
        deviceMetaSuspendBuilder.set('deviceId', event.deviceId);
      }

      var deviceMetaSuspend = deviceMetaSuspendBuilder.done();
      setCurrStatus(deviceMetaSuspend);
      events.push(deviceMetaSuspend);

      pushBasalClockForward(event.time);

      // now build a basal event with `deliveryType: 'suspend'`
      // we don't have duration info yet, so we'll save it in currBasal to finish later
      var suspendBasalBuilder = bob.makeSuspendBasal()
        .with_time(event.time)
        .with_timezoneOffset(event.timezoneOffset)
        .with_deviceTime(event.deviceTime);

      if (event.deviceId != null) {
        suspendBasalBuilder.set('deviceId', event.deviceId);
      }

      if (currBasal != null) {
        suspendBasalBuilder.with_previous(_.omit(currBasal, 'previous'));
        var suppressed = _.cloneDeep(_.omit(currBasal, 'previous'));
        suspendBasalBuilder.with_suppressed(suppressed);
      }

      var suspendBasal = suspendBasalBuilder.done();
      setCurrBasal(suspendBasal);
      events.push(suspendBasal);
    },

    /**
     * Report a wizard event.
     *
     * Wizard events can optionally contain a "bolus" field.  If the provided arguments contain a bolus field
     * the simulator will automatically generate the provided object as a separate bolus event.  So, the simulator
     * should *not* be called separately with the same bolus event.
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into a wizard event recorded by the simulator
     */
    wizard: function(){
      var event = ensureTimestamp(combineArguments(arguments));

      addEvent(bob.makeWizard(), event);

    },

    /**
     * Return the current array of events that the simulator has generated.
     * @returns {Array} events the simulator has generated
     */
    getEvents: function(){
      return events;
    }
  };
};
