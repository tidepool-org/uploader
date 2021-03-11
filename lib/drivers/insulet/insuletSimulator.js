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

/* eslint-disable no-param-reassign */

import _ from 'lodash';
import util from 'util';

import annotate from '../../eventAnnotations';
import common from './common';
import simulations from '../../commonFunctions';

const isBrowser = typeof window !== 'undefined';
const debug = isBrowser ? require('bows')('InsuletDriver') : console.log;

/**
 * Creates a new "simulator" for Insulet OmniPod data.  The simulator has methods for events like
 *
 * cbg(), smbg(), basal(), bolus(), settingsChange(), etc.
 *
 * This simulator exists as an abstraction over the Tidepool APIs.  It was written to simplify the conversion
 * of static, "retrospective" audit logs from devices into events understood by the Tidepool platform.
 *
 * On the input side, you have events extracted from an Insulet .ibf file.  They should be delivered to the simulator
 * in time order.
 *
 * Once all input activities are collected, the simulator will have accumulated events that the Tidepool Platform
 * will understand into a local "events" array.  You can retrieve the events by calling `getEvents()`
 *
 * @param config
 * @returns {*}
 */
exports.make = (config = {}) => {
  const settings = config.settings || null;
  const events = [];

  let activationStatus = null;
  let currBasal = null;
  let currBolus = null;
  let currStatus = null;
  let currTimestamp = null;

  function setActivationStatus(status) {
    activationStatus = status;
  }

  function setCurrBasal(basal) {
    currBasal = basal;
  }

  function setCurrBolus(bolus) {
    currBolus = bolus;
  }

  function setCurrStatus(status) {
    currStatus = status;
  }

  function ensureTimestamp(e) {
    if (currTimestamp > e.time) {
      throw new Error(
        util.format(`Timestamps must be in order.  Current timestamp was ${currTimestamp}, but got ${e}`),
      );
    }
    currTimestamp = e.time;
    return e;
  }

  function simpleSimulate(e) {
    ensureTimestamp(e);
    events.push(e);
  }

  function fillInSuppressed(e) {
    let schedName = null;
    let rate = null;
    const suppressed = _.clone(e.suppressed);
    if (e.previous != null) {
      if (e.previous.deliveryType === 'scheduled') {
        schedName = e.previous.scheduleName;
        rate = e.previous.rate;
      } else if (e.previous.deliveryType === 'temp') {
        if (e.previous.suppressed != null) {
          if (e.previous.suppressed.deliveryType === 'scheduled') {
            schedName = e.previous.suppressed.scheduleName;
            rate = e.previous.suppressed.rate;
          }
        }
      }
    }

    if (schedName != null) {
      e.suppressed = suppressed.with_scheduleName(schedName)
        .with_rate(rate)
        .done();
    } else {
      delete e.suppressed;
    }
  }

  return {
    alarm: (event) => {
      if (event.payload != null && event.payload.stopsDelivery === true) {
        if (event.status == null && event.index != null) {
          throw new Error('An Insulet alarm with a log index that has `stopsDelivery` in the payload must have a `status`.');
        }
      }
      simpleSimulate(event);
    },
    basal: (event) => {
      ensureTimestamp(event);
      if (currBasal != null) {
        // sometimes there can be duplicate suspend basals, so we return early
        // if we come across a suspend basal when we're already in one
        if (currBasal.deliveryType === 'suspend' && event.deliveryType === 'suspend') {
          return;
        }
        // completing a resume event from a new pod activation
        // see podActivation() below for more details
        if (currStatus != null && currStatus.status === 'suspended') {
          if (activationStatus != null && activationStatus.status === 'resumed') {
            const resume = activationStatus.with_previous(_.omit(currStatus, 'previous'))
              .with_reason({ resumed: 'manual' })
              .done();
            setCurrStatus(resume);
            events.push(resume);
            setActivationStatus(null);
          } else if (event.deliveryType !== 'suspend') {
            // if we're in a suspend basal, we need to leave the currStatus because
            // a resume is probably still impending
            // but if we've already moved on to a basal that's not deliveryType: suspend
            // then we need to wipe the slate clean
            setCurrStatus(null);
          }
        }
        if (!currBasal.isAssigned('duration')) {
          currBasal.with_duration(Date.parse(event.time) - Date.parse(currBasal.time));
        }
        if (currBasal.isAssigned('suppressed')) {
          fillInSuppressed(currBasal);
        }
        currBasal = currBasal.done();
        event.previous = _.omit(currBasal, 'previous');
        events.push(currBasal);
      } else if (activationStatus != null && activationStatus.status === 'resumed') {
        // at the very beginning of a file (which === when currBasal is null) it is common
        // to see a pod activation and then a basal; the former will end up as a `deviceEvent`
        // resume without a `previous` but it's technically accurate, so we upload it anyway
        let initialResume;
        // we don't really expect this to happen, but just in case...
        if (currStatus != null && currStatus.status === 'suspended') {
          initialResume = activationStatus.with_previous(_.omit(currStatus, 'previous'))
            .with_reason({ resumed: 'manual' })
            .done();
          setCurrStatus(initialResume);
          events.push(initialResume);
        } else {
        // this is the more common case, in which case we finish building a resume
        // that won't be connected with a suspend, kinda pointless, but accurate
          initialResume = activationStatus.with_reason({ resumed: 'manual' })
            .done();
          setCurrStatus(initialResume);
          events.push(initialResume);
        }
        setActivationStatus(null);
      }
      setCurrBasal(event);
    },
    bolus: (event) => {
      simpleSimulate(event);
      setCurrBolus(event);
    },
    /*
     * When an OmniPod users cancels a bolus partway through delivery, the data includes
     * a bolus termination event, and this is the only way for us to access the information
     * that the bolus volume intially programmed and the bolus volume actually delivered
     * were not the same.
     *
     * The logic probably looks a little funny here: we add the `missedInsulin` from the bolus
     * termination to the bolus volume reported on the bolus event to obtain the bolus volume
     * that the user initially programmed. This is because an Insulet bolus record always
     * reports the volume of bolus that was actually delivered, not the bolus that was programmed.
     * (Same for duration on extended bolus (components).)
     */
    bolusTermination: (event) => {
      if (currBolus != null) {
        if (currBolus.subType === 'normal') {
          currBolus.expectedNormal = common.fixFloatingPoint(currBolus.normal + event.missedInsulin, 2);
        } else if (event.durationLeft > 0) {
          currBolus.expectedExtended = common.fixFloatingPoint(currBolus.extended + event.missedInsulin, 2);
          currBolus.expectedDuration = currBolus.duration + event.durationLeft;
        } else {
          currBolus.expectedNormal = common.fixFloatingPoint(currBolus.normal + event.missedInsulin, 2);
        }
      } else {
        debug('Cannot find bolus to modify given bolus termination: [%j]. PDM was likely reset.', event);
      }
    },
    changeDeviceTime: (event) => {
      simpleSimulate(event);
    },
    changeReservoir: (event) => {
      if (event.status == null) {
        throw new Error('An Insulet `reservoirChange` event must have a `status`.');
      }
      simpleSimulate(event);
    },
    /*
     * We simulate the final basal in an Insulet .ibf file as a special case, to keep the logic
     * of basal() above cleaner. This basal is special because we don't have a following basal
     * to use to determine the duration. Instead we look up the basal against the settings at
     * the time of upload and try to determine a duration for the basal based on this information.
     */
    finalBasal: () => {
      if (currBasal != null) {
        if (currBasal.deliveryType !== 'scheduled') {
          if (currBasal.deliveryType === 'temp') {
            if (currBasal.isAssigned('suppressed')) {
              fillInSuppressed(currBasal);
            }
            currBasal = currBasal.done();
          } else if (!currBasal.isAssigned('duration')) {
            currBasal.duration = 0;
            annotate.annotateEvent(currBasal, 'basal/unknown-duration');
            currBasal = currBasal.done();
          } else {
            currBasal = currBasal.done();
          }
        } else if (settings != null) {
          currBasal = simulations.finalScheduledBasal(currBasal, settings, 'insulet');
        } else {
          currBasal.with_duration(0);
          annotate.annotateEvent(currBasal, 'basal/unknown-duration');
          currBasal = currBasal.done();
        }
        events.push(currBasal);
      }
    },
    /*
     * Pod activations are not *quite* resume events (because further user intervention is
     * required before insulin delivery resumes - namely, confirming that cannula insertion
     * was successful). So we build activations as resumes, save them in `activationStatus`
     * and then complete them as resumes upon receipt of the next `basal` event.
     */
    podActivation: (event) => {
      ensureTimestamp(event);
      setActivationStatus(event);
    },
    resume: (event) => {
      ensureTimestamp(event);
      if (currStatus != null && currStatus.status === 'suspended') {
        event = event.with_previous(_.omit(currStatus, 'previous'));
      }
      event = event.done();
      setCurrStatus(event);
      events.push(event);
    },
    pumpSettings: (event) => {
      simpleSimulate(event);
    },
    smbg: (event) => {
      simpleSimulate(event);
    },
    suspend: (event) => {
      // suspends in a series are pretty common - e.g., when an alarm that implies
      // a stoppage of delivery produces a suspend and then we also get something
      // like a pod deactivation immediately following
      // if we're already in a suspended state, we just return early to maintain that state
      if (currStatus != null && currStatus.status === 'suspended') {
        return;
      }
      ensureTimestamp(event);
      // there can be stray activation events that hang around
      // i.e., when there was a PDM error and then a date & time change
      // they are definitely no longer relevant if we come across an actual suspend
      // so we reset back to null
      if (activationStatus != null && activationStatus.status === 'resumed') {
        setActivationStatus(null);
      }
      setCurrStatus(event);
      events.push(event);
    },
    wizard: (event) => {
      simpleSimulate(event);
    },
    getEvents: () => {
      function filterOutZeroBoluses() {
        return _.filter(events, (event) => {
          // we include the index on all objects to be able to sort accurately in
          // pump-event order despite date & time settings changes, but it's not
          // part of our data model, so we delete before uploading
          delete event.index;
          if (event.type === 'bolus') {
            if (event.normal === 0 && !event.expectedNormal && !event.carbInput) {
              return false;
            }
            delete event.carbInput;
            return true;
          }

          if (event.type === 'wizard') {
            const bolus = event.bolus || null;
            if (bolus != null) {
              if (bolus.normal === 0 && !bolus.expectedNormal && !event.carbInput) {
                return false;
              }
              return true;
            }
          }
          return true;
        });
      }
      // because we have to wait for the *next* basal to determine the duration of a current
      // basal, basal events get added to `events` out of order wrt other events
      // (although within their own type all the basals are always in order)
      // end result: we have to sort events again before we try to upload them
      const orderedEvents = _.sortBy(filterOutZeroBoluses(), (e) => e.time);

      return orderedEvents;
    },
  };
};
