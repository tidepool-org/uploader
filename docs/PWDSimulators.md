## Background

In order to be future-compatible with Bluetooth-enabled devices that may communicate with the Tidepool platform in real-time (and/or AP remote telemetry systems), the [jellyfish API](https://github.com/tidepool-org/jellyfish) and [Tidepool platform *ingestion* data model](http://developer.tidepool.io/data-model/v1/) are designed for real-time data ingestion. The data we currently read out of CareLink CSV files or directly from devices consists entirely of *retrospective* records, and this presents some data ingestion challenges. Our current strategy for adapting these retrospective records to our real-time data model and ingestion API is to build a PWD ("person with diabetes") "simulator" for each device/source from which we are able to extract data. The simulator processes the retrospective records and then adds them to an array of records - in **strict** sequential order; the array is then `POST`ed to jellyfish. The idea here is that the simulator creates a array that represents a "play back" of all the events that happened on the pump, in the form we would expect if the device had been communicating with the platform in real-time. We simply upload them all batched together *ex post facto* instead of individually in real-time.

## Drivers (pre-simulator)

The device driver is the (obvious) first step in data processing. The driver for each device extracts the raw data and begins the process of building the JavaScript objects that will become the JSON objects uploaded to jellyfish.

Every device driver should be configured with an instance of the [objectBuilder](https://github.com/tidepool-org/chrome-uploader/blob/master/lib/objectBuilder.js) (often referred to just as the 'builder' and stored in `cfg.builder`). An instance of the builder contains functions for building every type (or sub-type) of object in the ingestion data model; these functions contain some built-in validation for required fields, but not for the contents of any (optional or required) field(s).

In the cases of datatypes that are simple, point-in-time events that do not meaningfully interact with other events (for example, smbg readings), *all* of the building of the corresponding Tidepool JavaScript objects should be done in the device driver. There may be exceptions, but in many cases the following types will fall into this category:

- `cbg`
- `bloodKetone` and `urineKetone`
- `deviceEvent`: sub-types `alarm`, `calibration`, `reservoirChange`, `prime`, and `timeChange`
- `settings`
- `smbg`

Whether `bolus` and `wizard` events can be completely built in the simulator depends on how the connections between these events are represented and how early termination of a bolus is represented.

Some datatypes are not point-in-time (e.g., a `basal` represents a rate of insulin delivery over an interval of time) and/or interact with other events, as the `status` sub-type of `deviceEvent` events do (these represent suspensions and resumes of insulin delivery and thus imply the stopping and starting of basal delivery). The building of these events cannot usually be completed in the device driver, so the general strategy is to *start* building them in the driver, then pass them to the simulator, where the building is completed before they are uploaded to the Tidepool platform via jellyfish. While there may be exceptions, in many cases the following types will fall into the category of objects that cannot be completely built in a device driver:

- `basal` - often the `duration` and sometimes other information, especially in the case of temp basals, needs to be added via the simulator
- `deviceEvent`: sub-types `status`

**NB:** The general guideline for what tasks can and cannot be done in a device driver with respect to object building is that device drivers should be *stateless* with respect to the object building they do. For example, the task of saving the last basal rate change recorded by an insulin pump as the `currBasal` and setting its duration only upon coming across the *next* basal rate change event is *exactly* the kind of task the simulator should be doing, not the device driver.

## Simulators

PWD simulators are, at present, unique to each device we are able to extract data from. Thus far, each device has presented its own unique challenges, particularly with respect to event interplay. For example, the only way to determine the programmed vs. actual insulin delivery when a bolus is interrupted using an Insulet OmniPod insulin delivery system is to feed each `bolus` event to the simulator and store it in the simulator's state as the current bolus (`currBolus`), then feed every bolus termination event into the simulator as well, modifying the `currBolus` with the information from the termination event. This is necessary because the Insulet data format does not include any key to link bolus terminations to their associated boluses; only the order of the events on the pump relates terminations to the boluses terminated.

The following are the most common tasks performed in a PWD simulator, grouped by datatype:

- `basal`
   + determining and setting `duration`
   + determining and setting the `suppressed` basal object(s) for `temp` and `suspend` basals
   + adding the `previous` event
- `bolus`
   + connecting `normal` and `square` components into a dual-wave bolus where applicable
   + connecting boluses with accompanying `wizard` events, although this is more commonly accomplished in the device driver
   + adding an `expectedNormal` and/or `expectedExtended` and `expectedDuration` when a bolus is terminated early (i.e., bolus volume programmed !== bolus volume delivered)
- `deviceEvent` sub-type `status`
   + adding the `previous` event

## Date & Time Changes

At present, no diabetes device that Tidepool knows about represents the date & time at which device events occur in either UTC time or in a way that is anchored to UTC time - i.e., providing timezone and/or offset-from-UTC information. Because we are correlating data from many different sources for each user, we rely on UTC time as the absolute scale on which to place all the time series data ingested by the Tidepool platform. To reconcile the fact that devices only store and allow retrieval of device-local date & time information with our use of UTC time, we currently ask the user to select a named timezone upon upload and apply that timezone to the user's data across-the-board to generate a UTC timestamp for each datum. Asking the user for a named timezone allows us to adjust for Daylight Savings Time (DST) when translating device local time into UTC time, but it does not account for changes to the device-local date & time the user may have made - for example, when travelling across timezones.

For many of the devices and/or data sources we are currently ingesting data from, we *are* able to read in changes to the device's date & time settings. Our goal for the long-term is to use a combination of asking the user for the named timezone that applies to their most recent data and the device's history of changes to the date & time settings to "bootstrap" all device event timestamps into UTC time with 100% accuracy. However, at the moment we are not doing this; we are only applying the named timezone selected by the user on upload across-the-board and parsing device date & time settings changes for storage, but we are not using the date & time settings changes to adjust the offset used to transform device-local time into UTC time. The reason for this is that we will have to introduce this kind of "bootstrapping" into 100% accurate UTC times for all devices that we ingest data from at the same time to avoid misaligning data from different device sources. Once we are able to read date & time settings change from *all* the devices and/or sources we support for data ingestion, we will add this "bootstrapping" for all devices and sources at once.