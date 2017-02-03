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

const _ = require('lodash');
const sundial = require('sundial');
const util = require('util');

const annotate = require('../eventAnnotations');

const common = require('../commonFunctions');

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('../bows')('Medtronic600Driver') : console.log;

/**
 * Creates a new "simulator" for Medtronic pump data.
 *
 * Once all input activities are collected, the simulator will have accumulated events that the
 * Tidepool Platform will understand into a local "events" array.  You can retrieve the events by
 * calling `getEvents()`
 *
 */
exports.make = (config) => {
  const events = [];

  const TWENTY_FOUR_HOURS = 864e5;

  let currBasal = null;
  let currSMBG = null;
  let currTimestamp = null;
  let currPumpSettings = null;
  let suspendingEvent = null;
  let currStatus = null;

  function setCurrBasal(basal) {
    currBasal = basal;
  }

  function setCurrSMBG(smbg) {
    currSMBG = smbg;
  }

  function setCurrPumpSettings(settings) {
    currPumpSettings = settings;
  }

  function setSuspendingEvent(event) {
    suspendingEvent = event;
  }

  function setCurrStatus(status) {
    currStatus = status;
  }

  function ensureTimestamp(e) {
    if (currTimestamp > e.time) {
      throw new Error(
        util.format('Timestamps must be in order.  Current timestamp was[%s], but got[%j]',
        currTimestamp, e));
    }
    currTimestamp = e.time;
    return e;
  }

  function simpleSimulate(e) {
    ensureTimestamp(e);
    events.push(e);
  }

  function checkForScheduleChanges(cancelled) {
    let changed = false; // flag if schedule change did occur

    if (currBasal.deliveryType !== 'scheduled' && currPumpSettings) {
      // check for schedule changes during temp basal or suspended basal

      const currSchedule = currPumpSettings.basalSchedules[currPumpSettings.activeSchedule];

      const checkSchedules = (startTime, endTime, durationBeforeMidnight) => {
        for (const i in currSchedule) {
          debug(currBasal.deviceTime, 'startTime:', startTime, 'endTime', endTime, 'currSchedule.start', currSchedule[i].start, currSchedule[i].rate);

          if (cancelled) {
            // we should stop looking for schedule changes after a temp basal was cancelled

            if (currBasal.time.slice(0, 10) === cancelled.time.slice(0, 10) &&
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
            ((currBasal.suppressed.deliveryType === 'scheduled' && currSchedule[i].rate !== currBasal.suppressed.rate) ||
              (currBasal.suppressed.suppressed && // there's a nested suppresed
                currBasal.suppressed.suppressed.deliveryType === 'scheduled' && currSchedule[i].rate !== currBasal.suppressed.suppressed.rate))) {
            // there was a schedule rate change _during_ the temp/suspended basal
            const adjustedDuration = (durationBeforeMidnight + currSchedule[i].start) - startTime;
            const oldDuration = currBasal.duration;
            currBasal.with_duration(adjustedDuration);
            if (currBasal.isAssigned('payload')) {
              currBasal.payload.duration = oldDuration;
            } else {
              currBasal.payload = {
                duration: oldDuration,
              };
            }
            currBasal = currBasal.done();
            events.push(currBasal);

            const newSuppressed = {
              type: 'basal',
              deliveryType: 'scheduled',
              rate: currSchedule[i].rate,
            };
            if (currPumpSettings) {
              newSuppressed.scheduleName = currPumpSettings.activeSchedule;
            }

            let newBasal;
            if (currBasal.deliveryType === 'temp') {
              newBasal = config.builder.makeTempBasal();
              if (currBasal.percent) {
                newBasal.with_rate(currSchedule[i].rate * currBasal.percent)
                  .with_percent(currBasal.percent);
              } else {
                newBasal.with_rate(currBasal.rate);
              }
            } else {
              newBasal = config.builder.makeSuspendBasal();
            }

            const newJsDate = new Date(Date.parse(currBasal.deviceTime) + adjustedDuration);
            newBasal.with_duration(oldDuration - adjustedDuration)
              .with_deviceTime(sundial.formatDeviceTime(newJsDate))
              .set('index', currBasal.index);
            config.tzoUtil.fillInUTCInfo(newBasal, newJsDate);


            if (currBasal.suppressed.suppressed) {
              newBasal.set('suppressed', _.clone(currBasal.suppressed));
              newBasal.suppressed.suppressed = newSuppressed;
            } else {
              newBasal.set('suppressed', newSuppressed);
            }

            annotate.annotateEvent(newBasal, 'medtronic/basal/fabricated-from-schedule');
            setCurrBasal(newBasal);
            changed = true;
          }
        }
      };

      const startTime = common.computeMillisInCurrentDay(currBasal);

      const endTime = startTime + currBasal.duration;

      if (endTime >= TWENTY_FOUR_HOURS) {
        // check before midnight
        checkSchedules(startTime, TWENTY_FOUR_HOURS, 0);
        // check after midnight
        checkSchedules(0, endTime - TWENTY_FOUR_HOURS, TWENTY_FOUR_HOURS - startTime);
      } else {
        checkSchedules(startTime, endTime, 0);
      }
    }
    return changed;
  }

  return {
    basal(event) {
      ensureTimestamp(event);

      if (currBasal != null) {
        if (suspendingEvent != null) {
          // The current basal only ran until the suspending event occurred
          const duration = Date.parse(suspendingEvent.time) - Date.parse(currBasal.time);
          if (duration > 0) {
            // suspending event did happen after the basal event
            currBasal.with_duration(duration);
            common.truncateDuration(currBasal, 'medtronic');
            currBasal = currBasal.done();
            events.push(currBasal);

            // create suspended basal at time of alarm or reservoir change and set that as the
            // current basal
            const suspendedDuration = Date.parse(event.time) - Date.parse(suspendingEvent.time);
            const suspendedBasal = config.builder.makeSuspendBasal()
              .with_deviceTime(suspendingEvent.deviceTime)
              .with_time(suspendingEvent.time)
              .with_timezoneOffset(suspendingEvent.timezoneOffset)
              .with_conversionOffset(suspendingEvent.conversionOffset)
              .with_duration(suspendedDuration)
              .set('index', suspendingEvent.index);
            setCurrBasal(suspendedBasal);

            debug('Embedding a suspend/resume event in a device event:', suspendingEvent);

            const status = {
              time: currBasal.time,
              deviceTime: currBasal.deviceTime,
              timezoneOffset: currBasal.timezoneOffset,
              conversionOffset: currBasal.conversionOffset,
              deviceId: event.deviceId,
              duration: currBasal.duration,
              type: 'deviceEvent',
              subType: 'status',
              status: 'suspended',
              reason: {
                suspended: 'automatic',
                resumed: 'manual',
              },
            };
            if (suspendingEvent.alarmType) {
              status.payload = {
                cause: suspendingEvent.alarmType,
              };
            }
            annotate.annotateEvent(status, 'medtronic/status/fabricated-from-device-event');

            // also push the device event with its new status object
            suspendingEvent.status = status;
          }
          events.push(suspendingEvent);
          setSuspendingEvent(null); // reset device event as not to re-use
        }

        if (!currBasal.isAssigned('duration')) {
          // calculate current basal's duration
          const duration = Date.parse(event.time) - Date.parse(currBasal.time);
          currBasal.duration = duration;
        }

        if (event.deliveryType === 'temp') {
          if (event.duration === 0) {
            // temp basal was cancelled:
            // The pump sends a temp basal record with duration 0.
            // We use the time this record was sent to calculate the actual duration.
            checkForScheduleChanges(event);
            currBasal.with_expectedDuration(currBasal.duration);
            const duration = Date.parse(event.time) - Date.parse(currBasal.time);
            currBasal.with_duration(duration);

            common.truncateDuration(currBasal, 'medtronic');
            currBasal = currBasal.done();
            events.push(currBasal);
            setCurrBasal(null);

            return;
          }

          if (currBasal.deliveryType === 'temp' && event.duration !== 0) {
            // temp basal was updated
            currBasal.with_expectedDuration(currBasal.duration)
              .with_duration(Date.parse(event.time) - Date.parse(currBasal.time));
            event.suppressed = _.clone(currBasal.suppressed);
          }

          if (currBasal.deliveryType === 'scheduled') {
            const suppressed = {
              type: 'basal',
              deliveryType: 'scheduled',
              rate: currBasal.rate,
            };
            if (currBasal.isAssigned('scheduleName')) {
              suppressed.scheduleName = currBasal.scheduleName;
            }
            event.suppressed = suppressed;

            if (event.rate == null) {
              if (event.percent == null) {
                throw new Error('Temp basal without rate or percent');
              }
              event = event.with_rate(currBasal.rate * event.percent);
            }
          }
        }

        if (event.deliveryType === 'suspend' && currBasal.deliveryType !== 'suspend') {
          event.suppressed = {
            type: 'basal',
            deliveryType: currBasal.deliveryType,
            rate: currBasal.rate,
          };
          if (currBasal.isAssigned('scheduleName')) {
            event.suppressed.scheduleName = currBasal.scheduleName;
          }

          if (currBasal.deliveryType === 'temp') {
            // nest suppressed scheduled basal in temp basal inside suspended basal
            event.suppressed.suppressed = currBasal.suppressed;

            const tempStartToResumeDuration = (Date.parse(currStatus.time) -
              Date.parse(currBasal.time)) + currStatus.duration;
            if (currBasal.duration > tempStartToResumeDuration) {
              // temp basal is still active after suspend, so restart temp basal on resume

              // check that the indexes are the same, as the suspended basal was
              // created from the same record as the suspend/resume event
              if (currStatus && currStatus.index === event.index) {
                event.duration = currStatus.duration;

                const resumeBasal = _.clone(currBasal);
                resumeBasal.time = new Date(Date.parse(currStatus.time) + currStatus.duration)
                  .toISOString();
                resumeBasal.deviceTime = sundial.formatDeviceTime(
                  Date.parse(currStatus.deviceTime) + currStatus.duration);
                resumeBasal.index = event.resumeIndex;
                delete resumeBasal.duration; // we don't know the new duration yet

                // finish up the temp basal before the suspend
                if (currBasal.duration) {
                  currBasal.with_expectedDuration(currBasal.duration);
                  const duration = Date.parse(event.time) - Date.parse(currBasal.time);
                  currBasal.with_duration(duration);

                  resumeBasal.duration = currBasal.expectedDuration - currBasal.duration -
                    currStatus.duration;
                }
                common.truncateDuration(currBasal, 'medtronic');
                events.push(currBasal.done());

                // check if suspended basal is crossing schedule changes
                setCurrBasal(event);
                if (checkForScheduleChanges()) {
                  // we should remember to update resume basal's suppressed too
                  resumeBasal.suppressed = currBasal.suppressed.suppressed;
                }
                common.truncateDuration(currBasal, 'medtronic');
                events.push(currBasal.done());

                setCurrBasal(resumeBasal);
                return;
              }
            }
          }
        }

        checkForScheduleChanges();

        common.truncateDuration(currBasal, 'medtronic');
        currBasal = currBasal.done();
        events.push(currBasal);
      }

      if (currPumpSettings && event.deliveryType === 'scheduled') {
        if (!event.isAssigned('scheduleName')) {
          event.with_scheduleName(currPumpSettings.activeSchedule);
        }
      }

      setCurrBasal(event);
    },
    bolus(event) {
      simpleSimulate(event);
    },
    wizard(event) {
      simpleSimulate(event);
    },
    smbg(event) {
      // TODO: DRY this out once Animas mmol/L issue (https://trello.com/c/Ry3Cz0eC) is resolved
      if (currSMBG != null && currSMBG.value === event.value) {
        debug('Duplicate SMBG value (', event.value, ')', currSMBG.subType, currSMBG.time, '/', event.subType, event.time);
        const duration = Date.parse(event.time) - Date.parse(currSMBG.time);
        if ((duration < (15 * sundial.MIN_TO_MSEC)) && (event.subType === 'manual') && (currSMBG.subType === 'linked')) {
          debug('Dropping duplicate manual value');
          return;
        }
      }
      simpleSimulate(event);
      setCurrSMBG(event);
    },
    pumpSettings(event) {
      simpleSimulate(event);
      setCurrPumpSettings(event);
    },
    suspendResume(event) {
      simpleSimulate(event);
      setCurrStatus(event);
    },
    cbg(event) {
      simpleSimulate(event);
    },
    alarm(event) {
      const type = event.alarmType;
      if ((type === 'no_delivery' || type === 'auto_off' || type === 'no_power') &&
        suspendingEvent === null) {
        // alarm will be added later (with fabricated status event) when basal is resumed,
        // because only then will we know the duration it was suspended for
        setSuspendingEvent(event);
      } else {
        if (type === 'other' && event.payload.alarm_id === 3 && currBasal) {
          debug('Battery out too long at', event.time, ', annotating previous basal at', currBasal.time);
          annotate.annotateEvent(currBasal, 'basal/unknown-duration');

          if (currBasal.deliveryType === 'scheduled' && currPumpSettings) {
            // set last basal to not be longer than scheduled duration
            const currSchedule = currPumpSettings.basalSchedules[currPumpSettings.activeSchedule];
            const startTime = common.computeMillisInCurrentDay(currBasal);
            for (let i = 0; i < currSchedule.length; i++) {
              debug(currBasal.deviceTime, 'startTime:', startTime, 'currSchedule:', currSchedule[i].start, currSchedule[i].rate);

              if ((startTime >= currSchedule[i].start) &&
                (currBasal.rate === currSchedule[i].rate)) {
                if (currSchedule[i + 1]) {
                  const scheduledDuration = currSchedule[i + 1].start - currSchedule[i].start;
                  debug('Found scheduled duration:', scheduledDuration);
                  currBasal.duration = scheduledDuration;
                  break;
                }
              }
            }
          }
        }
        simpleSimulate(event);
      }
    },
    prime(event) {
      simpleSimulate(event);
    },
    rewind(event) {
      // check that a suspending event, e.g. "no delivery" alarm
      // hasn't already been triggered
      if (suspendingEvent === null) {
        setSuspendingEvent(event);
      } else {
        simpleSimulate(event);
      }
    },
    calibration(event) {
      simpleSimulate(event);
    },
    changeDeviceTime(event) {
      simpleSimulate(event);
    },
    finalBasal(finalRecordTime) {
      if (currBasal) {
        if (currBasal.deliveryType === 'scheduled' && currPumpSettings) {
          currBasal.with_scheduleName(currPumpSettings.activeSchedule);
          if (!currBasal.isAssigned('duration')) {
            currBasal = common.finalScheduledBasal(currBasal, currPumpSettings, 'medtronic');
          }
        } else {
          if (!currBasal.isAssigned('duration')) {
            currBasal.with_duration(0);
            annotate.annotateEvent(currBasal, 'basal/unknown-duration');
          }
          common.truncateDuration(currBasal, 'medtronic');
          currBasal = currBasal.done();
        }

        events.push(currBasal);
      }
    },
    getEvents() {
      function filterOutInvalidData() {
        return _.filter(events, (event) => {
          // filter out zero boluses
          if (event.type === 'bolus') {
            if (event.normal === 0 && !event.expectedNormal) {
              return false;
            } else {
              return true;
            }
          } else if (event.type === 'wizard') {
            const bolus = event.bolus || null;
            if (bolus != null) {
              if (bolus.normal === 0 && !bolus.expectedNormal) {
                return false;
              } else {
                return true;
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
      const orderedEvents = _.sortBy(filterOutInvalidData(), e => e.time);

      _.forEach(orderedEvents, (record) => {
        delete record.index;
        delete record.resumeIndex;
        delete record.jsDate;
      });

      return orderedEvents;
    },
  };
};
