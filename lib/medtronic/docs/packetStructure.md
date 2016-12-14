# Medtronic packet structure

Below we've documented the structure of the various packets in the Medtronic pump history, matching the fields and record types to our [data model](http://developer.tidepool.io/data-model). Unknown bits are designated with `??`.

## Basals

### Scheduled basal
![basal](images/svg/basal.svg)

### Temp basal
![temp basal](images/svg/tempBasal.svg)

#### Temp basal duration
![temp basal duration](images/svg/tempBasalDuration.svg)

## Boluses

### Manual bolus
![bolus](images/svg/bolus.svg)

### Wizard bolus

![bolus wizard](images/svg/wizard.svg)


## Device events

### Pump alarm
![pump alarm](images/svg/alarmPump.svg)

### Suspend
![suspend](images/svg/suspend.svg)

### Prime
![prime](images/svg/prime.svg)

### Rewind
![rewind](images/svg/rewind.svg)


## SMBG

### Manual
![smbg](images/svg/smbg.svg)

### Linked
![linked smbg](images/svg/smbgLinked.svg)


## Device settings

### Basal schedules

![basal schedules](images/svg/basalSchedules.svg)

### Wizard settings
![wizard settings](images/svg/wizardSettings.svg)
