## Background

In order to be future-compatible with Bluetooth-enabled devices that may communicate with the Tidepool platform in real-time (and/or AP remote telemetry systems), the [jellyfish API](https://github.com/tidepool-org/jellyfish) and [Tidepool platform *ingestion* data model](http://developer.tidepool.io/data-model/v1/) are designed for real-time data ingestion. The data we currently read out of CareLink CSV files or directly from devices consists entirely of *retrospective* records, and this presents some data ingestion challenges. Our current strategy for adapting these retrospective records to our real-time data model and ingestion API is to build a PWD ("person with diabetes") "simulator" for each device/source from which we are able to extract data. The simulator processes the retrospective records and then adds them to an array of records - in **strict** sequential order; the array is then `POST`ed to jellyfish. The idea here is that the simulator creates a array that represents a "play back" of all the events that happened on the pump, in the form we would expect if the device had been communicating with the platform in real-time. We simply upload them all batched together *ex post facto* instead of individually in real-time.

## Drivers (pre-simulator)

The device driver is the (obvious) first step in data processing. The driver for each device extracts the raw data and begins the process of building the JavaScript objects that will become the JSON objects uploaded to jellyfish.

Every device driver should be configured with an instance of the [objectBuilder](https://github.com/tidepool-org/chrome-uploader/blob/master/lib/objectBuilder.js) (often referred to just as the 'builder' and stored in `cfg.builder`). An instance of the builder contains functions for building every type (or sub-type) of object in the ingestion data model; these functions contain some built-in validation for required fields, but not for the contents of any (optional or required) field(s).

In the cases of datatypes that are simple, point-in-time events that do not meaningfully interact with other events (for example, smbg readings), *all* of the building of the corresponding Tidepool JavaScript objects should be done in the device driver. There may be exceptions, but in many cases the following types will fall into this category:

- `cbg`
- `bloodKetone` and `urineKetone`
- `deviceMeta`: sub-types `alarm`, `calibration`, `deliveryReset`, `prime`, and `timeChange`
- `settings`
- `smbg`

Whether `bolus` and `wizard` events can be completely built in the simulator depends on how the connections between these events are represented and how early termination of a bolus is represented.

Some datatypes are not point-in-time (e.g., a `basal` represents a rate of insulin delivery over an interval of time) and/or interact with other events, as the `status` sub-type of `deviceMeta` events do (these represent suspensions and resumes of insulin delivery and thus imply the stopping and starting of basal delivery). The building of these events cannot usually be completed in the device driver, so the general strategy is to *start* building them in the driver, then pass them to the simulator, where the building is completed before they are uploaded to the Tidepool platform via jellyfish. While there may be exceptions, in many cases the following types will fall into the category of objects that cannot be completely built in a device driver:

- `basal` - often the `duration` and sometimes other information, especially in the case of temp basals, needs to be added via the simulator
- `deviceMeta`: sub-types `status`

**NB:** The general guideline for what tasks can and cannot be done in a device driver with respect to object building is that device drivers should be *stateless* with respect to the object building they do. For example, the task of saving the last basal rate change recorded by an insulin pump as the `currBasal` and setting its duration only upon coming across the *next* basal rate change event is *exactly* the kind of task the simulator should be doing, not the device driver.

## Simulators

PWD simulators are, at present, unique to each device we are able to extract data from. Thus far, each device has presented its own unique challenges, particularly with respect to event interplay. For example, the only way to represent the suspension of insulin delivery that occurs when an occlusion occurs in an Insulet OmniPod insulin delivery system is to build a `deviceMeta` event with `status: suspended` alongside the source `deviceMeta` event with `alarmType: occlusion` and feed both to the simulator, where the simulator will use the `status: suspended` information to truncate the duration of a currently active basal rate.

The following are the most common tasks performed in a PWD simulator, grouped by datatype:

- `basal`
   + determining and setting `duration`
   + determining and setting the `suppressed` basal object(s) for `temp` and `suspend` basals
   + adding the `previous` event
- `bolus`
   + connecting `normal` and `square` components into a dual-wave bolus where applicable
   + connecting boluses with accompanying `wizard` events, although this is more commonly accomplished in the device driver
   + adding an `expectedNormal` and/or `expectedExtended` and `expectedDuration` when a bolus is terminated early (i.e., bolus volume programmed !== bolus volume delivered)
- `deviceMeta` sub-type `status`
   + adding the `previous` event
