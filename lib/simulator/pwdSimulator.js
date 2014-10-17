/*
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
  var dateTime = sundial.parse(e.time, e.timezoneOffset);
  if (typeof(dateTime) === 'string') {
    dateTime = moment.tz(dateTime);
  }
  var millisInDay = dateTime.hour() * 60 * 60 * 1000;
  millisInDay += dateTime.minute() * 60 * 1000;
  millisInDay += dateTime.second() * 1000;
  millisInDay += dateTime.milliseconds();
  return millisInDay;
};


/**
 * Creates a new "simulator" for a diabetic individual.  The simulator has methods for events like
 *
 * cbg(), smbg(), basal(), bolus(), settingsChange(), etc.
 *
 * This simulator exists as an abstraction over the Tidepool APIs.  It was written to simplify the conversion
 * of static, "retrospective" audit logs from devices into events understood by the Tidepool platform.
 *
 * On the input side, you have activities that happen to a diabetic.  They should be delivered to the simulator
 * in time order.
 *
 * Once all input activities are collected, the simulator will have accumulated events that the Tidepool Platform
 * will understand into a local "events" array.  You can retrieve the events by calling `getEvents()`
 *
 * @param defaults
 * @returns {*}
 */
module.exports = function makeSimulator(defaults){
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
  var currTimestamp = null;

  function setCurrBasal(basal){
    currBasal = basal;
  }

  function ensureTimestamp(e){
    if (currTimestamp > e.time) {
      throw new Error(
        util.format('Timestamps must be in order.  Current timestamp was[%s], but got[%j]', currTimestamp, e)
      );
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
    var timeMillis = sundial.parse(time).valueOf();

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
      var doneTime = sundial.parse(parts[doneIndex].time).valueOf() + parts[doneIndex].duration;
      for (var i = 1; i < parts.length; ++i) {
        var partCompletion = sundial.parse(parts[i].time).valueOf() + parts[i].duration;
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
              var currSchedule = currSettings.basalSchedules[sched.scheduleName];
              if (currSchedule == null) {
                parts.splice(doneIndex, 1);
              } else {
                var millisInDay = computeMillisInCurrentDay(parts[doneIndex]);
                for (i = 0; i < currSchedule.length; ++i) {
                  if (currSchedule[i].start > millisInDay) {
                    break;
                  }
                }

                var currRate = currSchedule[i];
                var newTs = sundial.parse(parts[doneIndex].time).subtract(millisInDay, 'ms').add(currRate.start, 'ms');
                parts[doneIndex] = bob.makeScheduledBasal()
                  .with_scheduleName(sched.scheduleName)
                  .with_time(newTs.toISOString())
                  .with_timezoneOffset(sched.timezoneOffset)
                  .with_rate(currRate.rate)
                  .with_duration((i+1 === currSchedule.length ? twentyFourHours : currSchedule[i+1].start) - currRate.start)
                  .set('annotations', [{ code: 'basal/fabricated-from-schedule' }])
                  .done()
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
            time: sundial.parse(doneTime).toISOString(),
            duration: parts[0].duration - (doneTime - sundial.parse(parts[0].time).valueOf())
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
        currBasal = parts[0];

        events.push(currBasal);
        return true;
      }
      return false;
    }

    do {
      var ptr = currBasal;
      var parts = [];
      while (ptr != null) {
        parts.push(_.omit(ptr, 'suppressed'));
        ptr = ptr.suppressed;
      }
    } while (processParts(parts));
  }

  return {
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
     * Resumes basal and bolus delivery from a previous suspend
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into a suspend deviceMeta event recorded by the simulator
     */
    resume: function(){
      var event = addEvent(bob.makeDeviceMetaResume(), ensureTimestamp(combineArguments(arguments)));

      if (currBasal.deliveryType !== 'suspend') {
        return;
      }

      var eventMillis = sundial.parse(event.time).valueOf();
      currBasal.duration = eventMillis - sundial.parse(currBasal.time).valueOf();
      pushBasalClockForward(event.time);

      var nextBasal = _.cloneDeep(currBasal.suppressed);
      if (nextBasal == null) {
        return;
      }

      if (nextBasal.duration != null) {
        nextBasal.duration -= eventMillis - sundial.parse(currBasal.time).valueOf();
      }

      nextBasal.time = event.time;
      if (event.timezoneOffset != null) {
        nextBasal.timezoneOffset = event.timezoneOffset;
      }

      nextBasal.previous = _.omit(currBasal, 'previous');
      events.push(nextBasal);
      setCurrBasal(nextBasal);
    },

    /**
     * Report a scheduledBasal event.
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into a scheduledBasal event recorded by the simulator
     */
    scheduledBasal: function(){
      var event = ensureTimestamp(combineArguments(arguments));
      pushBasalClockForward(event.time);

      var currSchedule = null;
      if (currSettings != null) {
        currSchedule = currSettings.basalSchedules[currSettings.activeSchedule];
      }

      if (currSchedule == null || currSchedule.length === 0) {
        if (event.duration == null) {
          event.duration = 0;
          annotateEvent(event, 'basal/unknown-duration');
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
          event.duration = 0;
          annotateEvent(event, 'basal/off-schedule-rate')
        }
      }

      if (currBasal != null) {
        event.previous = _.omit(currBasal, 'previous');
      }

      currBasal = addEvent(bob.makeScheduledBasal(), event);
    },

    /**
     * Report a settings event.
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into a settings event recorded by the simulator
     */
    settings: function(){
      currSettings = addEvent(bob.makeSettings(), ensureTimestamp(combineArguments(arguments)));
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
      var event = addEvent(bob.makeDeviceMetaSuspend(), ensureTimestamp(combineArguments(arguments)));

      pushBasalClockForward(event.time);
      var suspendBasalBuilder = bob.makeSuspendBasal()
        .with_time(event.time)
        .with_timezoneOffset(event.timezoneOffset)
        .with_deviceTime(event.deviceTime);

      if (currBasal != null) {
        suspendBasalBuilder.with_previous(_.omit(currBasal, 'previous'));
        suspendBasalBuilder.with_suppressed(_.cloneDeep(_.omit(currBasal, 'previous')));
      }

      var suspendBasal = suspendBasalBuilder.done();
      setCurrBasal(suspendBasal);
      events.push(suspendBasal);
    },

    /**
     * Report a tempBasal event.
     *
     * @param argument... Variable number of arguments, each should be an object.  The field:value pairs passed in
     *                    are smooshed together into a scheduledBasal event recorded by the simulator
     */
    tempBasal: function(){
      var event = ensureTimestamp(combineArguments(arguments));
      pushBasalClockForward(event.time);

      if (currBasal != null) {
        // omit twice so that we actually get different objects
        event.previous = _.omit(currBasal, 'previous');
        event.suppressed = _.cloneDeep(_.omit(currBasal, 'previous'));

        if (event.percent != null) {
          event.rate = currBasal.rate * event.percent;
        }
      }

      currBasal = addEvent(bob.makeTempBasal(), event);
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
