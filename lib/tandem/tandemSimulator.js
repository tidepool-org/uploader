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

var annotate = require('../eventAnnotations');
var common = require('./common');

var twentyFourHours = 24 * 60 * 60 * 1000;

/**
 * Creates a new "simulator" for Tandem data.  The simulator has methods for events like
 *
 * cbg(), smbg(), basal(), bolus(), settingsChange(), etc.
 *
 * This simulator exists as an abstraction over the Tidepool APIs.  It was written to simplify the conversion
 * of static, "retrospective" audit logs from devices into events understood by the Tidepool platform.
 *
 * On the input side, you have events extracted from an insulin pump.  They should be delivered to the simulator
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
    var settings = config.settings || null;
    var events = [];

    var activationStatus = null;
    var currBasal = null;
    var currBolus = null;
    var currStatus = null;
    var currTimestamp = null;

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

    function ensureTimestamp(e){
        if (currTimestamp > e.time) {
            throw new Error(
                util.format('Timestamps must be in order.  Current timestamp was[%s], but got[%j]', currTimestamp, e)
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
        var schedName = null, suppressed = _.clone(e.suppressed);
        if (e.previous != null) {
            if (e.previous.deliveryType === 'scheduled') {
                schedName = e.previous.scheduleName;
            }
            else if (e.previous.deliveryType === 'temp') {
                if (e.previous.suppressed != null) {
                    if (e.previous.suppressed.deliveryType === 'scheduled') {
                        schedName = e.previous.suppressed.scheduleName;
                    }
                }
            }
        }

        if (schedName != null) {
            e.suppressed = suppressed.with_scheduleName(schedName).done();
        }
        else {
            e.suppressed = null;
        }
    }

    return {
        alarm: function(event) {
            simpleSimulate(event);
        },
        basal: function(event){
            simpleSimulate(event);
            setCurrBasal(event);
        },
        bolus: function(event) {
            simpleSimulate(event);
            setCurrBolus(event);
        },
        bolusTermination: function(event) {
        },
        changeDeviceTime: function(event) {
            simpleSimulate(event);
        },
        changeReservoir: function(event) {
            simpleSimulate(event);
        },
        finalBasal: function() {
            if (currBasal != null) {
                var millisInDay = sundial.getMsFromMidnight(currBasal.time, currBasal.timezoneOffset);
                var basalSched = settings.basalSchedules[currBasal.scheduleName];
                if (basalSched == null || basalSched.length === 0) {
                    if (currBasal.duration == null || typeof currBasal.duration === 'string') {
                        currBasal.duration = 0;
                        annotate.annotateEvent(currBasal, 'basal/unknown-duration');
                        currBasal = currBasal.done();
                    }
                }
                else {
                    for (var i = basalSched.length - 1; i >= 0; --i) {
                        if (basalSched[i].start <= millisInDay) {
                            break;
                        }
                    }
                    if (basalSched[i].rate === currBasal.rate) {
                        currBasal.duration = (i + 1 === basalSched.length ? twentyFourHours : basalSched[i + 1].start - millisInDay);
                        currBasal = currBasal.done();
                    }
                    else {
                        if (currBasal.duration == null || typeof currBasal.duration === 'string') {
                            currBasal.duration = 0;
                            annotate.annotateEvent(currBasal, 'basal/unknown-duration');
                            currBasal = currBasal.done();
                        }
                    }
                }
                events.push(currBasal);
            }
        },
        resume: function(event) {
            ensureTimestamp(event);
            if (currStatus != null && currStatus.status === 'suspended') {
                event = event.with_previous(_.omit(currStatus, 'previous'));
            }
            event = event.done();
            setCurrStatus(event);
            events.push(event);
        },
        settings: function(event) {
            simpleSimulate(event);
        },
        smbg: function(event) {
            simpleSimulate(event);
        },
        suspend: function(event) {
            if (currStatus != null && currStatus.status === 'suspended') {
                return;
            }
            ensureTimestamp(event);
            if (activationStatus != null && activationStatus.status === 'resumed') {
                setActivationStatus(null);
            }
            setCurrStatus(event);
            events.push(event);
        },
        wizard: function(event) {
            simpleSimulate(event);
        },
        getEvents: function() {
            // because we have to wait for the *next* basal to determine the duration of a current
            // basal, basal events get added to `events` out of order wrt other events
            // (although within their own type all the basals are always in order)
            // end result: we have to sort events again before we try to upload them
            var orderedEvents = _.sortBy(_.filter(events, function(event) {
                if (event.type === 'bolus') {
                    return !(event.normal === 0 && !event.expectedNormal);
                }
                return true;
            }), function(e) { return e.time; });

            return orderedEvents;
        }
    };
};