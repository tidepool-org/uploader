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
    this.currSMBG = null;
    this.currTimestamp = null;
    this.currPumpSettings = null;
    this.suspendingEvent = null;
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

  checkForScheduleChanges(cancelled) {
    let changed = false; // flag if schedule change did occur

    if (this.currBasal.deliveryType !== 'scheduled' && this.currPumpSettings) {
      // check for schedule changes during temp basal or suspended basal

      const currSchedule =
        this.currPumpSettings.basalSchedules[this.currPumpSettings.activeSchedule];

      const checkSchedules = (startTime, endTime, durationBeforeMidnight) => {
        for (const i of currSchedule) {
          debug(this.currBasal.deviceTime, 'startTime:', startTime, 'endTime', endTime,
            'currSchedule.start', currSchedule[i].start, currSchedule[i].rate);

          if (cancelled) {
            // we should stop looking for schedule changes after a temp basal was cancelled

            if (this.currBasal.time.slice(0, 10) === cancelled.time.slice(0, 10) &&
              (durationBeforeMidnight > 0)) {
              // temp basal was cancelled before midnight and we're now looking after midnight
              break;
            }

            if (common.computeMillisInCurrentDay(cancelled) < currSchedule[i].start) {
              // temp basal was cancelled before new schedule started
              break;
            }
          }

          if ((startTime <= currSchedule[i].start) && (endTime > currSchedule[i].start) &&
            ((this.currBasal.suppressed.deliveryType === 'scheduled' &&
                currSchedule[i].rate !== this.currBasal.suppressed.rate) ||
              (this.currBasal.suppressed.suppressed && // there's a nested suppresed
                this.currBasal.suppressed.suppressed.deliveryType === 'scheduled' &&
                currSchedule[i].rate !== this.currBasal.suppressed.suppressed.rate))) {
            // there was a schedule rate change _during_ the temp/suspended basal
            const adjustedDuration = (durationBeforeMidnight + currSchedule[i].start) - startTime;
            const oldDuration = this.currBasal.duration;
            this.currBasal.with_duration(adjustedDuration);
            if (this.currBasal.isAssigned('payload')) {
              this.currBasal.payload.duration = oldDuration;
            } else {
              this.currBasal.payload = {
                duration: oldDuration,
              };
            }
            this.currBasal = this.currBasal.done();
            this.events.push(this.currBasal);

            const newSuppressed = {
              type: 'basal',
              deliveryType: 'scheduled',
              rate: currSchedule[i].rate,
            };
            if (this.currPumpSettings) {
              newSuppressed.scheduleName = this.currPumpSettings.activeSchedule;
            }

            let newBasal;
            if (this.currBasal.deliveryType === 'temp') {
              newBasal = this.config.builder.makeTempBasal();
              if (this.currBasal.percent) {
                newBasal.with_rate(currSchedule[i].rate * this.currBasal.percent)
                  .with_percent(this.currBasal.percent);
              } else {
                newBasal.with_rate(this.currBasal.rate);
              }
            } else {
              newBasal = this.config.builder.makeSuspendBasal();
            }

            const newJsDate = new Date(Date.parse(this.currBasal.deviceTime) + adjustedDuration);
            newBasal.with_duration(oldDuration - adjustedDuration)
              .with_deviceTime(sundial.formatDeviceTime(newJsDate))
              .set('index', this.currBasal.index);
            this.config.tzoUtil.fillInUTCInfo(newBasal, newJsDate);


            if (this.currBasal.suppressed.suppressed) {
              newBasal.set('suppressed', _.clone(this.currBasal.suppressed));
              newBasal.suppressed.suppressed = newSuppressed;
            } else {
              newBasal.set('suppressed', newSuppressed);
            }

            annotate.annotateEvent(newBasal, 'medtronic/basal/fabricated-from-schedule');
            this.currBasal = newBasal;
            changed = true;
          }
        }
      };

      const startTime = common.computeMillisInCurrentDay(this.currBasal);

      const endTime = startTime + this.currBasal.duration;

      if (endTime >= Medtronic600Simulator.TWENTY_FOUR_HOURS) {
        // check before midnight
        checkSchedules(startTime, Medtronic600Simulator.TWENTY_FOUR_HOURS, 0);
        // check after midnight
        checkSchedules(0, endTime - Medtronic600Simulator.TWENTY_FOUR_HOURS,
          Medtronic600Simulator.TWENTY_FOUR_HOURS - startTime);
      } else {
        checkSchedules(startTime, endTime, 0);
      }
    }
    return changed;
  }

  basal(event) {
    this.ensureTimestamp(event);

    if (this.currBasal != null) {
      if (this.suspendingEvent != null) {
        // The current basal only ran until the suspending event occurred
        const duration = Date.parse(this.suspendingEvent.time) - Date.parse(this.currBasal.time);
        if (duration > 0) {
          // suspending event did happen after the basal event
          this.currBasal.with_duration(duration);
          common.truncateDuration(this.currBasal, 'medtronic');
          this.currBasal = this.currBasal.done();
          this.events.push(this.currBasal);

          // create suspended basal at time of alarm or reservoir change and set that as the
          // current basal
          const suspendedDuration = Date.parse(event.time) - Date.parse(this.suspendingEvent.time);
          const suspendedBasal = this.config.builder.makeSuspendBasal()
            .with_deviceTime(this.suspendingEvent.deviceTime)
            .with_time(this.suspendingEvent.time)
            .with_timezoneOffset(this.suspendingEvent.timezoneOffset)
            .with_conversionOffset(this.suspendingEvent.conversionOffset)
            .with_duration(suspendedDuration)
            .set('index', this.suspendingEvent.index);
          this.currBasal = suspendedBasal;

          debug('Embedding a suspend/resume event in a device event:', this.suspendingEvent);

          const status = {
            time: this.currBasal.time,
            deviceTime: this.currBasal.deviceTime,
            timezoneOffset: this.currBasal.timezoneOffset,
            conversionOffset: this.currBasal.conversionOffset,
            deviceId: event.deviceId,
            duration: this.currBasal.duration,
            type: 'deviceEvent',
            subType: 'status',
            status: 'suspended',
            reason: {
              suspended: 'automatic',
              resumed: 'manual',
            },
          };
          if (this.suspendingEvent.alarmType) {
            status.payload = {
              cause: this.suspendingEvent.alarmType,
            };
          }
          annotate.annotateEvent(status, 'medtronic/status/fabricated-from-device-event');

          // also push the device event with its new status object
          this.suspendingEvent.status = status;
        }
        this.events.push(this.suspendingEvent);
        this.suspendingEvent = null; // reset device event as not to re-use
      }

      if (!this.currBasal.isAssigned('duration')) {
        // calculate current basal's duration
        const duration = Date.parse(event.time) - Date.parse(this.currBasal.time);
        this.currBasal.duration = duration;
      }

      /** TODO - try to handle cancelled temp basals
      if (this.currBasal.deliveryType === 'temp') {
        // temp basal was updated
        this.currBasal.with_expectedDuration(this.currBasal.duration)
          .with_duration(Date.parse(event.time) - Date.parse(this.currBasal.time));
      }
      */

      if (event.deliveryType === 'temp') {
        if (event.duration === 0) {
          // temp basal was cancelled:
          // The pump sends a temp basal record with duration 0.
          // We use the time this record was sent to calculate the actual duration.
          this.checkForScheduleChanges(event);
          this.currBasal.with_expectedDuration(this.currBasal.duration);
          const duration = Date.parse(event.time) - Date.parse(this.currBasal.time);
          this.currBasal.with_duration(duration);

          common.truncateDuration(this.currBasal, 'medtronic');
          this.currBasal = this.currBasal.done();
          this.events.push(this.currBasal);
          this.currBasal = null;

          return;
        }

        if (this.currBasal.deliveryType === 'temp' && event.duration !== 0) {
          // temp basal was updated
          this.currBasal.with_expectedDuration(this.currBasal.duration)
            .with_duration(Date.parse(event.time) - Date.parse(this.currBasal.time));
          event.suppressed = _.clone(this.currBasal.suppressed);
        }

        if (this.currBasal.deliveryType === 'scheduled') {
          const suppressed = {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: this.currBasal.rate,
          };
          if (this.currBasal.isAssigned('scheduleName')) {
            suppressed.scheduleName = this.currBasal.scheduleName;
          }
          event.suppressed = suppressed;

          if (event.rate == null) {
            if (event.percent == null) {
              throw new Error('Temp basal without rate or percent');
            }
            event = event.with_rate(this.currBasal.rate * event.percent);
          }
        }
      }

      if (event.deliveryType === 'suspend' && this.currBasal.deliveryType !== 'suspend') {
        event.suppressed = {
          type: 'basal',
          deliveryType: this.currBasal.deliveryType,
          rate: this.currBasal.rate,
        };
        if (this.currBasal.isAssigned('scheduleName')) {
          event.suppressed.scheduleName = this.currBasal.scheduleName;
        }

        if (this.currBasal.deliveryType === 'temp') {
          // nest suppressed scheduled basal in temp basal inside suspended basal
          event.suppressed.suppressed = this.currBasal.suppressed;

          const tempStartToResumeDuration = (Date.parse(this.currStatus.time) -
            Date.parse(this.currBasal.time)) + this.currStatus.duration;
          if (this.currBasal.duration > tempStartToResumeDuration) {
            // temp basal is still active after suspend, so restart temp basal on resume

            // check that the indexes are the same, as the suspended basal was
            // created from the same record as the suspend/resume event
            if (this.currStatus && this.currStatus.index === event.index) {
              event.duration = this.currStatus.duration;

              const resumeBasal = _.clone(this.currBasal);
              resumeBasal.time =
                new Date(Date.parse(this.currStatus.time) + this.currStatus.duration).toISOString();
              resumeBasal.deviceTime = sundial.formatDeviceTime(
                Date.parse(this.currStatus.deviceTime) + this.currStatus.duration);
              delete resumeBasal.duration; // we don't know the new duration yet

              // finish up the temp basal before the suspend
              if (this.currBasal.duration) {
                this.currBasal.with_expectedDuration(this.currBasal.duration);
                const duration = Date.parse(event.time) - Date.parse(this.currBasal.time);
                this.currBasal.with_duration(duration);

                resumeBasal.duration = this.currBasal.expectedDuration - this.currBasal.duration -
                  this.currStatus.duration;
              }
              common.truncateDuration(this.currBasal, 'medtronic');
              this.events.push(this.currBasal.done());

              // check if suspended basal is crossing schedule changes
              this.currBasal = event;
              if (this.checkForScheduleChanges()) {
                // we should remember to update resume basal's suppressed too
                resumeBasal.suppressed = this.currBasal.suppressed.suppressed;
              }
              common.truncateDuration(this.currBasal, 'medtronic');
              this.events.push(this.currBasal.done());

              this.currBasal = resumeBasal;
              return;
            }
          }
        }
      }

      this.checkForScheduleChanges();

      common.truncateDuration(this.currBasal, 'medtronic');
      this.currBasal = this.currBasal.done();
      this.events.push(this.currBasal);
    }

    if (this.currPumpSettings && event.deliveryType === 'scheduled') {
      if (!event.isAssigned('scheduleName')) {
        event.with_scheduleName(this.currPumpSettings.activeSchedule);
      }
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
    // check that a suspending event, e.g. "no delivery" alarm
    // hasn't already been triggered
    if (this.suspendingEvent === null) {
      this.suspendingEvent = event;
    } else {
      this.simpleSimulate(event);
    }
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
            'medtronic');
        }
      } else {
        if (!this.currBasal.isAssigned('duration')) {
          this.currBasal.with_duration(0);
          annotate.annotateEvent(this.currBasal, 'basal/unknown-duration');
        }
        common.truncateDuration(this.currBasal, 'medtronic');
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

  getEvents() {
    const orderedEvents = _.sortBy(this.filterOutInvalidData(), e => e.time);

    _.forEach(orderedEvents, (record) => {
      delete record.index;
      delete record.jsDate;
    });

    return orderedEvents;
  }
}

module.exports = Medtronic600Simulator;
