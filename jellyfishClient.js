jellyfishClient = function(config) {
    var tidepoolServer = config.tidepoolServer;
    var deviceInfo = null;
    var REQUIRED = '**REQUIRED**';
    var OPTIONAL = '**OPTIONAL**';

    function setDefaults(info) {
        deviceInfo = _.pick(info, 'deviceId', 'source', 'timezoneOffset', 'units');
        deviceInfo.time = REQUIRED;
        deviceInfo.devicetime = REQUIRED;
    }

    function _createObject() {
        return {
            // use set to specify extra values that aren't in the template for
            // the data type
            set: function set(k, v) {
                if (v == null && this[k]) {
                    delete this[k];
                } else {
                    this[k] = v; 
                }
                return this; 
            },

            // checks the object, removes unused optional fields,
            // and returns a copy of the object with all functions removed.
            done: function() {
                var valid = _.reduce(this, function(result, value, key) {
                    if (value === REQUIRED) {
                        result.push(key);
                    }
                    return result;
                }, []);
                if (valid.length !== 0) {
                    console.log('Some arguments to ' + this.type + ' (' +
                        valid.join(',') + ') were not specified!');
                }

                return _.pick(this, function(value, key) {
                    return !(_.isFunction(value) || value === OPTIONAL);
                });
            },

            _bindProps: function() {
                _.forIn(this, function(value, key, obj) {
                    if (!_.isFunction(value)) {
                        obj['with_' + key] = obj.set.bind(obj, key);
                    }
                });
            }

        };
    }

    function _makeWithValue(typename) {
        var rec = _.assign(_createObject(), deviceInfo, {
            type: typename,
            value: REQUIRED
        });
        rec._bindProps();
        return rec;
    }

    function makeSMBG() {
        return _makeWithValue('smbg');
    }

    function makeCBG() {
        return _makeWithValue('cbg');
    }

    function makeNote() {
        return _makeWithValue('note');
    }

    function makeFood() {
        var rec = _.assign(_createObject(), deviceInfo, {
            type: 'food',
            carbs: REQUIRED
        });
        rec._bindProps();
        return rec;
    }

    function makeWizard() {
        var rec = _.assign(_createObject(), deviceInfo, {
            type: 'wizard',
            recommended: {
                carb: 0,
                correction: 0
            },
            bgInput: OPTIONAL,
            carbInput: OPTIONAL,
            insulinOnBoard: OPTIONAL,
            insulinCarbRatio: OPTIONAL,
            insulinSensitivity: OPTIONAL,
            bgTarget: OPTIONAL,
            bolus: OPTIONAL,
            payload: OPTIONAL
        });
        rec._bindProps();
        return rec;
    }

    function makeNormalBolus() {
        var rec = _.assign(_createObject(), deviceInfo, {
            type: 'bolus',
            subType: 'normal',
            normal: REQUIRED
        });
        rec._bindProps();
        return rec;
    }

    function makeSquareBolus() {
        var rec = _.assign(_createObject(), deviceInfo, {
            type: 'bolus',
            subType: 'square',
            extended: REQUIRED,
            duration: REQUIRED
        });
        rec._bindProps();
        return rec;
    }

    function makeDualBolus() {
        var rec = _.assign(_createObject(), deviceInfo, {
            type: 'bolus',
            subType: 'dual/square',
            normal: REQUIRED,
            extended: REQUIRED,
            duration: REQUIRED
        });
        rec._bindProps();
        return rec;
    }

    function makeScheduledBasal() {
        var rec = _.assign(_createObject(), deviceInfo, {
            type: 'basal',
            deliveryType: 'scheduled',
            scheduleName: REQUIRED,
            rate: REQUIRED,
            duration: REQUIRED,
            previous: OPTIONAL
        });
        rec._bindProps();
        return rec;
    }

    function makeSettings() {
        var rec = _.assign(_createObject(), deviceInfo, {
            type: 'settings',
            activeSchedule: REQUIRED,
            units: REQUIRED,
            basalSchedules: {},
            carbRatio: [],
            insulinSensitivity: [],
            bgTarget: [],
        });
        rec._bindProps();
        rec.add_basalScheduleItem = function(key, item) {
            if (!rec.basalSchedules[key]) {
                rec.basalSchedules[key] = [];
            }
            rec.basalSchedules[key].push(item);
        };
        rec.add_carbRatioItem = function(item) { rec.carbRatio.push(item); };
        rec.add_insulinSensitivityItem = function(item) { rec.insulinSensitivity.push(item); };
        rec.add_bgTargetItem = function(item) { rec.bgTarget.push(item); };
        return rec;
    }

    function postOne(data, callback) {
        // console.log('poster');
        var recCount = data.length;
        var happy = function(resp, status, jqxhr) {
            // console.log('Jellyfish post succeeded.');
            // console.log(status);
            // console.log(resp);
            callback(null, recCount);
        };
        var sad = function(jqxhr, status, err) {
            if (jqxhr.status == 413 && data.length > 1) { // request entity too big
                // but we can split the request and try again
                var l = Math.floor(data.length/2);
                var d1 = data.slice(0, l);
                var d2 = data.slice(l);
                async.mapSeries([d1, d2], postOne, function(err, result) {
                    if (err) {
                        return callback(err, 0);
                    }
                    return callback(null, result[0] + result[1]);
                });
                return;
            }
            if (jqxhr.responseJSON && jqxhr.responseJSON.errorCode && jqxhr.responseJSON.errorCode == 'duplicate') {
                console.log(jqxhr.responseJSON);
                callback('duplicate', jqxhr.responseJSON.index);
            } else {
                console.log('Jellyfish post failed.');
                console.log(status);
                console.log(err);
                console.log(jqxhr.responseJSON);
                callback(jqxhr.responseJSON, 0);
            }
        };
        tidepoolServer.postToJellyfish(data, happy, sad);
    }

    // we break up the posts because early jellyfish has a 1MB upload limit at one time
    // we're upping that limit
    function post(data, progress, callback) {
        var blocks = [];
        var BLOCKSIZE = 100;
        for (var i=0; i<data.length; i+=BLOCKSIZE) {
            blocks.push(data.slice(i, i+BLOCKSIZE));
        }
        var nblocks = 0;
        var post_and_progress = function(data, callback) {
            progress(nblocks++ * 100.0/blocks.length);
            return postOne(data, callback);
        };
        async.mapSeries(blocks, post_and_progress, callback);
    }


    return {
        setDefaults: setDefaults,
        makeSMBG: makeSMBG,
        makeCBG: makeCBG,
        makeNote: makeNote,
        makeFood: makeFood,
        makeWizard: makeWizard,
        makeScheduledBasal: makeScheduledBasal,
        makeNormalBolus: makeNormalBolus,
        makeSquareBolus: makeSquareBolus,
        makeDualBolus: makeDualBolus,
        makeSettings: makeSettings,
        post: post
    };
};