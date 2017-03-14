/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2017, Tidepool Project
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

// I *like* for..in
/* eslint no-restricted-syntax: [0, "ForInStatement"] */
// Param reassignment is what the simulator *does*, so let's ignore that linting rule...
/* eslint-disable no-param-reassign */

const _ = require('lodash');
const sundial = require('sundial');
const util = require('util');
const annotate = require('../eventAnnotations');
const common = require('../commonFunctions');

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('../bows')('Medtronic600Driver') : console.log;

/**
 * Creates a new "simulator" for Medtronic 600-series pump data.
 *
 * Once all input activities are collected, the simulator will have accumulated events that the
 * Tidepool Platform will understand into a local "events" array.  You can retrieve the events by
 * calling `getEvents()`
 *
 */

class Medtronic600Simulator {
  constructor(config) {
    this.config = config;
    this.events = [];

    this.currBasal = null;
    this.suspendingEvent = null; // TODO - we don't do anything with these yet.
    this.currSMBG = null;
    this.currTimestamp = null;
    this.currPumpSettings = null;
    this.currStatus = null;
  }

  static get TWENTY_FOUR_HOURS() {
    return 864e5;
  }

  addDatum(datum) {
    switch (datum.type) {
      case 'basal':
        this.basal(datum);
        break;
      case 'bolus':
        this.bolus(datum);
        break;
      case 'wizard':
        this.wizard(datum);
        break;
      case 'smbg':
        this.smbg(datum);
        break;
      case 'pumpSettings':
        this.pumpSettings(datum);
        break;
      case 'cbg':
        this.cbg(datum);
        break;
      case 'deviceEvent':
        if (datum.subType === 'status') {
          this.suspendResume(datum);
        } else if (datum.subType === 'alarm') {
          this.alarm(datum);
        } else if (datum.subType === 'prime') {
          this.prime(datum);
        } else if (datum.subType === 'reservoirChange') {
          this.rewind(datum);
        } else if (datum.subType === 'timeChange') {
          this.changeDeviceTime(datum);
        } else if (datum.subType === 'calibration') {
          this.calibration(datum);
        }
        break;
      default:
        debug('[Medtronic600Simulator] Unhandled type!', datum.type);
    }
  }

  ensureTimestamp(e) {
    if (this.currTimestamp > e.time) {
      throw new Error(
        util.format('Timestamps must be in order.  Current timestamp was[%s], but got[%j]',
          this.currTimestamp, e));
    }
    this.currTimestamp = e.time;
    return e;
  }

  simpleSimulate(e) {
    this.ensureTimestamp(e);
    this.events.push(e);
  }

  basal(event) {
    this.ensureTimestamp(event);

    if (event.isAssigned('duration')) {
      // Keep track of the basal's end time to make it easier to set restored basal start times
      event.set('basalEndTime', new Date(Date.parse(event.time).valueOf() + event.duration)
        .toISOString());
    }

    // Push suspend basals straight away. We apply all of the suspend shenanigans in getEvents().
    if (event.deliveryType === 'suspend') {
      this.events.push(event.done());
      return;
    }

    if (this.currBasal != null) {
      if (!this.currBasal.isAssigned('duration')) {
        // Calculate current basal's duration
        const duration = Date.parse(event.time) - Date.parse(this.currBasal.time);
        if (duration < 0) {
          throw new Error('A basal duration should not be less than zero');
        }
        this.currBasal.with_duration(duration);
        this.currBasal.set('basalEndTime', new Date(Date.parse(this.currBasal.time).valueOf() +
          duration).toISOString());
      }

      if (this.currBasal.deliveryType === 'temp') {
        if (event.deliveryType === 'scheduled') {
          // A basal segment start event can happen in the middle of a temp basal, either because
          // the schedule changed, or because the pump sends a normal basal for the suppressed basal
          // after sending the temp basal event.
          // Because the temp basal completion event pre-populates the duration, we can tell if a
          // scheduled event happens during a temp basal.
          if (event.time < this.currBasal.basalEndTime) {
            if (this.currBasal.suppressed.type === event.type &&
              this.currBasal.suppressed.deliveryType === event.deliveryType &&
              this.currBasal.suppressed.rate === event.rate &&
              this.currBasal.suppressed.scheduleName === event.scheduleName) {
              // If the segment start event is the same as the currently supressed basal, ignore it.
              return;
            }

            // If the schedule changes during a temp basal, turn the scheduled basal into a temp
            // basal with the basal info for this event in the suppressed field.
            // We don't need to worry about generating extra events, because the 600-series will
            // send another scheduled basal event at the end of the temp basal.
            const duration = Date.parse(event.time) - Date.parse(this.currBasal.time);

            // This event becomes the suppressed field for the new temp basal.
            const suppressedBasal = _.clone(event);

            // Just copy the existing temp basal, and update the details
            event = _.clone(this.currBasal);

            this.currBasal
              .set('duration', duration);

            event
              .set('duration', event.duration - duration)
              .set('time', suppressedBasal.time)
              .set('deviceTime', suppressedBasal.deviceTime)
              .set('suppressed', {
                type: suppressedBasal.type,
                deliveryType: suppressedBasal.deliveryType,
                rate: suppressedBasal.rate,
                scheduleName: suppressedBasal.scheduleName,
              });
            if (!isNaN(this.currBasal.percent)) {
              event.set('rate', suppressedBasal.rate * this.currBasal.percent);
            }
          }
        }

        if (event.time > this.currBasal.basalEndTime) {
          // After a temp basal, the next basal segment start event doesn't happen for up to
          // a minute after the temp basal complete event, leaving small basal data gaps every
          // time a temp basal finishes.
          // It's also feasible that we won't get a basal segment start event at all if the user
          // has cancelled a temp basal, and followed it up immediately with another temp basal.

          const newDeviceTime = new Date(Date.parse(this.currBasal.deviceTime).valueOf() +
            this.currBasal.duration);

          if (this.currBasal.suppressed.type !== event.type ||
            this.currBasal.suppressed.deliveryType !== event.deliveryType ||
            this.currBasal.suppressed.rate !== event.rate ||
            this.currBasal.suppressed.scheduleName !== event.scheduleName) {
            // If the new scheduled basal event doesn't have the same profile as the suppressed
            // basal, tack the suppressed basal onto the end of the temp basal before the new
            // scheduled basal starts.
            this.events.push(this.currBasal.done());

            const restoredBasal = this.config.builder.makeScheduledBasal()
              .with_time(this.currBasal.basalEndTime)
              .with_deviceTime(sundial.formatDeviceTime(newDeviceTime))
              .with_rate(this.currBasal.suppressed.rate)
              .with_scheduleName(this.currBasal.suppressed.scheduleName)
              .with_duration(Date.parse(event.time) - Date.parse(this.currBasal.basalEndTime))
              .with_conversionOffset(this.currBasal.conversionOffset)
              .with_timezoneOffset(this.currBasal.timezoneOffset);

            this.currBasal = restoredBasal;
          } else {
            // Otherwise, just fix the start time of the new basal event.
            event
              .with_time(this.currBasal.basalEndTime)
              .with_deviceTime(sundial.formatDeviceTime(newDeviceTime));
          }
        } else if (event.time < this.currBasal.basalEndTime) {
          const duration = Date.parse(event.time) - Date.parse(this.currBasal.time);
          this.currBasal
            .set('duration', duration);
        }
      }

      this.events.push(this.currBasal.done());
    }

    this.currBasal = event;
  }

  bolus(event) {
    this.simpleSimulate(event);
  }

  wizard(event) {
    this.simpleSimulate(event);
  }

  smbg(event) {
    // TODO: DRY this out once Animas mmol/L issue (https://trello.com/c/Ry3Cz0eC) is resolved
    if (this.currSMBG != null && this.currSMBG.value === event.value) {
      debug('Duplicate SMBG value (', event.value, ')', this.currSMBG.subType, this.currSMBG.time,
        '/', event.subType, event.time);
      const duration = Date.parse(event.time) - Date.parse(this.currSMBG.time);
      if ((duration < (15 * sundial.MIN_TO_MSEC)) && (event.subType === 'manual') &&
        (this.currSMBG.subType === 'linked')) {
        debug('Dropping duplicate manual value');
        return;
      }
    }
    this.simpleSimulate(event);
    this.currSMBG = event;
  }

  pumpSettings(event) {
    this.simpleSimulate(event);
    this.currPumpSettings = event;
  }

  suspendResume(event) {
    this.simpleSimulate(event);
    this.currStatus = event;
  }

  cbg(event) {
    this.simpleSimulate(event);
  }

  alarm(event) {
    const type = event.alarmType;
    if ((type === 'no_delivery' || type === 'auto_off' || type === 'no_power') &&
      this.suspendingEvent === null) {
      // alarm will be added later (with fabricated status event) when basal is resumed,
      // because only then will we know the duration it was suspended for
      this.suspendingEvent = event;
    } else {
      if (type === 'other' && event.payload.alarm_id === 3 && this.currBasal) {
        debug('Battery out too long at', event.time, ', annotating previous basal at',
          this.currBasal.time);
        annotate.annotateEvent(this.currBasal, 'basal/unknown-duration');

        if (this.currBasal.deliveryType === 'scheduled' && this.currPumpSettings) {
          // set last basal to not be longer than scheduled duration
          const currSchedule =
            this.currPumpSettings.basalSchedules[this.currPumpSettings.activeSchedule];
          const startTime = common.computeMillisInCurrentDay(this.currBasal);
          for (let i = 0; i < currSchedule.length; i++) {
            debug(this.currBasal.deviceTime, 'startTime:', startTime, 'currSchedule:',
              currSchedule[i].start, currSchedule[i].rate);

            if ((startTime >= currSchedule[i].start) &&
              (this.currBasal.rate === currSchedule[i].rate)) {
              if (currSchedule[i + 1]) {
                const scheduledDuration = currSchedule[i + 1].start - currSchedule[i].start;
                debug('Found scheduled duration:', scheduledDuration);
                this.currBasal.duration = scheduledDuration;
                break;
              }
            }
          }
        }
      }
      this.simpleSimulate(event);
    }
  }

  prime(event) {
    this.simpleSimulate(event);
  }

  rewind(event) {
    this.simpleSimulate(event);
  }

  calibration(event) {
    this.simpleSimulate(event);
  }

  changeDeviceTime(event) {
    this.simpleSimulate(event);
  }

  finalBasal() {
    if (this.currBasal) {
      if (this.currBasal.deliveryType === 'scheduled' && this.currPumpSettings) {
        this.currBasal.with_scheduleName(this.currPumpSettings.activeSchedule);
        if (!this.currBasal.isAssigned('duration')) {
          this.currBasal = common.finalScheduledBasal(this.currBasal, this.currPumpSettings,
            'medtronic600');
        }
      } else {
        if (!this.currBasal.isAssigned('duration')) {
          this.currBasal.with_duration(0);
          annotate.annotateEvent(this.currBasal, 'basal/unknown-duration');
        }
        this.currBasal = this.currBasal.done();
      }

      this.events.push(this.currBasal);
    }
  }

  filterOutInvalidData() {
    return _.filter(this.events, (event) => {
      // filter out zero boluses
      if (event.type === 'bolus') {
        if (event.normal === 0 && !event.expectedNormal) {
          return false;
        }
      } else if (event.type === 'wizard') {
        const bolus = event.bolus || null;
        if (bolus != null) {
          if (bolus.normal === 0 && !bolus.expectedNormal) {
            return false;
          }
        }
      }

      // Filter out dates 2012 and earlier.
      // We are doing this because we expect no pump to have true 2012 dates,
      // so anything generated in 2012 or earlier is really just because
      // someone didn't immediately set the date upon powering up the pump
      // for a while. Thus, we are dropping these events because we don't
      // know the actual, real time for them.
      if (parseInt(event.time.substring(0, 4), 10) <= 2012) {
        debug('Dropping event in 2012 or earlier: ', event);
        return false;
      }

      return true;
    });
  }

  removeEvent(eventToRemove) {
    _.remove(this.events, event => event === eventToRemove);
  }

  applySuspendedBasals() {
    const orderedBasals = _.sortBy(
      _.filter(this.events, event => event.type === 'basal'),
      e => e.time);

    let activeSuspendedBasal = null;
    let suppressedBasal = null;
    let restoredBasal = null;

    for (const entry of orderedBasals.entries()) {
      const index = entry[0];
      const basal = entry[1];
      if (activeSuspendedBasal != null) {
        if (Date.parse(basal.time) >= Date.parse(activeSuspendedBasal.basalEndTime)) {
          activeSuspendedBasal = null;
          suppressedBasal = null;
        } else if (basal.deliveryType !== 'suspend') {
          suppressedBasal = basal;
        }
      }

      if (basal.deliveryType === 'suspend') {
        activeSuspendedBasal = basal;
        if (restoredBasal != null && restoredBasal.basalEndTime > activeSuspendedBasal.time) {
          suppressedBasal = restoredBasal;
          restoredBasal = null;
        } else if (index > 0) {
          // Find the previous non-suspended basal
          suppressedBasal = null;
          for (let i = (index - 1); i >= 0; i--) {
            if (orderedBasals[i].deliveryType !== 'suspend') {
              suppressedBasal = orderedBasals[i];
              break;
            }
          }
          if (suppressedBasal == null) {
            throw new Error('Could not find previous suppressed basal');
          }
        } else {
          suppressedBasal = null;
        }
      }

      if (suppressedBasal != null) {
        if (Date.parse(suppressedBasal.basalEndTime) > Date.parse(activeSuspendedBasal.time)) {
          suppressedBasal.duration = Date.parse(activeSuspendedBasal.time) -
            Date.parse(suppressedBasal.time);
          // It's possible for duration to get down to 0 here (which is fine).
          if (suppressedBasal.duration < 0) {
            throw new Error('Should never get a duration of less than zero');
          } else if (suppressedBasal.duration === 0) {
            this.removeEvent(suppressedBasal);
          }
        }

        // If the activeSuspendedBasal doesn't already have suppressed info, supply it
        activeSuspendedBasal.suppressed = {
          type: suppressedBasal.type,
          deliveryType: suppressedBasal.deliveryType,
          rate: suppressedBasal.rate,
        };
        if (suppressedBasal.scheduleName != null) {
          activeSuspendedBasal.suppressed.scheduleName = suppressedBasal.scheduleName;
        }
        if (suppressedBasal.suppressed != null) {
          activeSuspendedBasal.suppressed.suppressed = _.clone(suppressedBasal.suppressed);
        }

        // Split a suspended basal when another basal event occurs during the suspension
        if (Date.parse(activeSuspendedBasal.basalEndTime) >
          Date.parse(suppressedBasal.basalEndTime)) {
          const suspendedBasalPortion = _.cloneDeep(activeSuspendedBasal);
          suspendedBasalPortion.duration = Date.parse(suppressedBasal.basalEndTime) -
            Date.parse(activeSuspendedBasal.time);
          if (suspendedBasalPortion.duration < 0) {
            throw new Error('Should never get a duration of less than zero');
          } else if (suspendedBasalPortion.duration === 0) {
            this.removeEvent(suspendedBasalPortion);
          } else {
            this.events.push(suspendedBasalPortion);
          }

          activeSuspendedBasal.duration -= suspendedBasalPortion.duration;
          if (activeSuspendedBasal.duration < 0) {
            throw new Error('Should never get a duration of less than zero');
          } else if (activeSuspendedBasal.duration === 0) {
            this.removeEvent(activeSuspendedBasal);
          }

          activeSuspendedBasal.time = suppressedBasal.basalEndTime;
          activeSuspendedBasal.deviceTime = sundial.formatDeviceTime(
            Date.parse(activeSuspendedBasal.deviceTime).valueOf() +
            suspendedBasalPortion.duration);
        }

        if (Date.parse(suppressedBasal.basalEndTime) >
          Date.parse(activeSuspendedBasal.basalEndTime)) {
          restoredBasal = _.cloneDeep(suppressedBasal);
          restoredBasal.time = activeSuspendedBasal.basalEndTime;
          restoredBasal.duration = Date.parse(suppressedBasal.basalEndTime) -
            Date.parse(restoredBasal.time);
          restoredBasal.deviceTime = sundial.formatDeviceTime(
            Date.parse(activeSuspendedBasal.deviceTime).valueOf() +
            activeSuspendedBasal.duration);
          if (restoredBasal.duration < 0) {
            throw new Error('Should never get a duration of less than zero');
          } else if (restoredBasal.duration === 0) {
            this.removeEvent(restoredBasal);
          } else {
            this.events.push(restoredBasal);
          }
        }
      }
    }
  }

  getEvents() {
    this.applySuspendedBasals();

    const orderedEvents = _.sortBy(this.filterOutInvalidData(), e => e.time);

    _.forEach(orderedEvents, (record) => {
      delete record.index;
      delete record.jsDate;
      delete record.basalEndTime;
    });

    return orderedEvents;
  }
}

module.exports = Medtronic600Simulator;
