/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
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
 *
 * THIS IS A GENERATED FILE -- DO NOT EDIT
 * Regenerate it by using generate_asante_driver_defines.py.
 */
 'use strict';

 module.exports = {
    pumpVersion: 69,
    userlist: {

        bt_BolusTypes: {
           bt_Now: { value: 0, name: 'Now'},
           bt_Timed: { value: 1, name: 'Timed'},
           bt_Combo: { value: 2, name: 'Combo'},
           bt_Undefined: { value: 3, name: 'Undefined'}
        },

        cc_CompletionCode: {
           cc_Normal: { value: 0, name: 'Normal'},
           cc_Alarm: { value: 1, name: 'Alarm'},
           cc_UserStop: { value: 2, name: 'UserStop'},
           cc_Detached: { value: 3, name: 'Detached'},
           cc_Prime: { value: 4, name: 'Prime'},
           cc_InProgress: { value: 5, name: 'InProgress'},
           cc_Cleared: { value: 6, name: 'Cleared'},
           cc_SysReset: { value: 7, name: 'SysReset'},
           cc_BattNotSafe: { value: 8, name: 'BattNotSafe'},
           cc_Undefined: { value: 9, name: 'Undefined'}
        },

        bc_EvtType: {
           bc_0_ProfileEvent: { value: 0, name: '0_ProfileEvent'},
           bc_1_TempBasal: { value: 1, name: '1_TempBasal'},
           bc_2_PumpStopped: { value: 2, name: '2_PumpStopped'}
        },

        pe_ProfileEvent: {
           pe_ProfileEdited: { value: 0, name: 'ProfileEdited'},
           pe_ProfileSelected: { value: 1, name: 'ProfileSelected'},
           pe_Max_Position: { value: 2, name: 'Max_Position'}
        },

        aa_Messages: {
           Damaged_pump_dropped: { value: 0, name: 'Damaged pump: dropped'},
           No_power_alarm: { value: 1, name: 'No power alarm'},
           Time_and_date_alarm: { value: 2, name: 'Time and date alarm'},
           Auto_off_alarm: { value: 3, name: 'Auto off alarm'},
           Blocked_set_alarm: { value: 4, name: 'Blocked set alarm'},
           Cartridge_empty_alarm: { value: 5, name: 'Cartridge empty alarm'},
           Connector_error: { value: 6, name: 'Connector error'},
           Pump_drive_error: { value: 7, name: 'Pump drive error'},
           Damaged_pump_wet: { value: 8, name: 'Damaged pump: wet'},
           Pump_body_connection_alarm: { value: 9, name: 'Pump body connection alarm'},
           Delivery_limit_alarm: { value: 10, name: 'Delivery limit alarm'},
           Pump_body_disconnect_alarm: { value: 11, name: 'Pump body disconnect alarm'},
           Choose_settings_alarm: { value: 12, name: 'Choose settings alarm'},
           Version_mismatch_alarm: { value: 13, name: 'Version mismatch alarm'},
           Key_alert: { value: 14, name: 'Key alert'},
           Very_low_power_replace_pump_body_soon: { value: 15, name: 'Very low power, replace pump body soon'},
           Very_low_cartridge: { value: 16, name: 'Very low cartridge'},
           Temp_basal_alert: { value: 17, name: 'Temp basal alert'},
           Low_cartridge: { value: 18, name: 'Low cartridge'},
           Dead_pump_body_battery: { value: 19, name: 'Dead pump body: battery'},
           Reminder_Check_bg: { value: 20, name: 'Reminder: Check bg'},
           Bolus_reminder: { value: 21, name: 'Bolus reminder'},
           Daily_reminder: { value: 22, name: 'Daily reminder'},
           Bolus_stopped: { value: 23, name: 'Bolus stopped'},
           Pump_reminder: { value: 24, name: 'Pump reminder'},
           Pump_body_connected: { value: 25, name: 'Pump body connected'},
           Pump_body_detached: { value: 26, name: 'Pump body detached'},
           Pump_stopped: { value: 27, name: 'Pump stopped'},
           Missed_basal: { value: 28, name: 'Missed basal'},
           Missed_bolus: { value: 29, name: 'Missed bolus'},
           Delivery_insulin_on_board: { value: 30, name: 'Delivery insulin on board'},
           Flashlight_limit_reached: { value: 31, name: 'Flashlight limit reached'},
           Delivery_canceled: { value: 32, name: 'Delivery canceled'},
           Bolus_timer_canceled: { value: 33, name: 'Bolus timer canceled'},
           Asantesync_initializing: { value: 34, name: 'Asantesync: initializing'},
           No_active_message: { value: 35, name: 'No active message'}
        },

        ac_ClearCondition: {
           ac_StillPending: { value: 0, name: 'StillPending'},
           ac_UserAcked: { value: 1, name: 'UserAcked'},
           ac_CradleAttached: { value: 2, name: 'CradleAttached'},
           ac_PumpAttached: { value: 3, name: 'PumpAttached'},
           ac_PumpAttachedGoodBatt: { value: 4, name: 'PumpAttachedGoodBatt'},
           ac_PumpAllowsFlashlight: { value: 5, name: 'PumpAllowsFlashlight'},
           ac_PumpDetached: { value: 6, name: 'PumpDetached'},
           ac_UIStartPump: { value: 7, name: 'UIStartPump'},
           ac_NoPower: { value: 8, name: 'NoPower'},
           ac_VeryLowCart: { value: 9, name: 'VeryLowCart'},
           ac_CartridgeEmpty: { value: 10, name: 'CartridgeEmpty'},
           ac_ExitedPrime: { value: 11, name: 'ExitedPrime'},
           ac_SetTimeDate: { value: 12, name: 'SetTimeDate'},
           ac_SufficientPower: { value: 13, name: 'SufficientPower'},
           ac_TempBasalEnded: { value: 14, name: 'TempBasalEnded'},
           ac_MAX_LEVEL: { value: 15, name: 'MAX_LEVEL'}
        },

        pt_PrimeTypes: {
           pt_Tube: { value: 0, name: 'Tube'},
           pt_Cannula: { value: 1, name: 'Cannula'},
           pt_Undefined: { value: 2, name: 'Undefined'}
        },

        ct_ConnectionTypes: {
           ct_pbConnect: { value: 0, name: 'pbConnect'},
           ct_pbDisconnect: { value: 1, name: 'pbDisconnect'},
           ct_craConnect: { value: 2, name: 'craConnect'},
           ct_craDisconnect: { value: 3, name: 'craDisconnect'},
           ct_ucConnect: { value: 4, name: 'ucConnect'},
           ct_ucDisconnect: { value: 5, name: 'ucDisconnect'},
           ct_donConnect: { value: 6, name: 'donConnect'},
           ct_donDisconnect: { value: 7, name: 'donDisconnect'},
           ct_illConnect: { value: 8, name: 'illConnect'},
           ct_illDisconnect: { value: 9, name: 'illDisconnect'}
        },

        pbv_VersionState: {
           pbv_Unknown: { value: 0, name: 'pbv_Unknown'},
           pbv_Before: { value: 1, name: 'pbv_Before'},
           pbv_Same: { value: 2, name: 'pbv_Same'},
           pbv_After: { value: 3, name: 'pbv_After'}
        },

        BGUnitsTypes: {
           mg_dL: { value: 0, name: 'dL'},
           mmol_L: { value: 1, name: 'mmol_L'}
        },

        IOBModes: {
           BGOnly: { value: 0, name: 'BGOnly'},
           EntireBolus: { value: 1, name: 'EntireBolus'}
        },

        bbs_BolusButtonSelect: {
           BolusButtonOff: { value: 0, name: 'BolusButtonOff'},
           AudioBolusButton: { value: 1, name: 'AudioBolusButton'},
           SmartBolusButton: { value: 2, name: 'SmartBolusButton'}
        },

        TimeFormats: {
           TwelveHour: { value: 0, name: 'TwelveHour'},
           TwentyFourHour: { value: 1, name: 'TwentyFourHour'}
        },

        DailyAlertFrequencys: {
           Undefined: { value: 0, name: 'Undefined'},
           Everyday: { value: 1, name: 'Everyday'},
           Weekdays: { value: 2, name: 'Weekdays'},
           Weekends: { value: 3, name: 'Weekends'}
        },

        BeepVolumes: {
           Volume1: { value: 0, name: 'Volume1'},
           Volume2: { value: 1, name: 'Volume2'},
           Volume3: { value: 2, name: 'Volume3'},
           Volume4: { value: 3, name: 'Volume4'},
           Volume5: { value: 4, name: 'Volume5'}
        },

        ScreenTimeouts: {
           SlowTimeout: { value: 0, name: 'SlowTimeout'},
           FastTimeout: { value: 1, name: 'FastTimeout'}
        },

        ReasonForStop: {
           Detached: { value: 0, name: 'Detached'},
           StopBtn: { value: 1, name: 'StopBtn'},
           Alarm: { value: 2, name: 'Alarm'},
           Prime: { value: 3, name: 'Prime'},
           SetClock: { value: 4, name: 'SetClock'},
           XchngPump: { value: 5, name: 'XchngPump'},
           Settings: { value: 6, name: 'Settings'},
           BattUnsafe: { value: 7, name: 'BattUnsafe'}
        },

        TimeEditLogFlagBits: {
           UserTimeFlag: { value: 0, name: 'UserTimeFlag'},
           EditCause: { value: 1, name: 'EditCause'}
        }
    },
    recordTypes: {

        LOG_BOLUS: {
            value: 0,
            name: 'Log Bolus',
            max: 450,
            type: 'log',
            struct: 's2i4si5b.',
            fields: [
                'crc',
                'DateTime',
                'SeqNmbr',
                'BolusID',
                'ClicksDelivered',
                'NowClicksRequested',
                'TimedClicksRequested',
                'EndTime',
                'Type',
                'CompletionCode',
                'duration15MinUnits',
                'SmartBolus',
                'SmartTotalOverride'
            ]
        },
    
        LOG_SMART: {
            value: 1,
            name: 'Log Smart',
            max: 450,
            type: 'log',
            struct: 's2is2hn7h2b',
            fields: [
                'crc',
                'DateTime',
                'SeqNmbr',
                'BolusID',
                'CurrentBG',
                'FoodCarbs',
                'IOB',
                'IOBMode',
                'TotalInsulin',
                'GrossBGInsulin',
                'GrossCarbInsulin',
                'NetBGInsulin',
                'NetCarbInsulin',
                'CarbInsulinPercent',
                'BolusDelivered',
                'TotalOverride'
            ]
        },
    
        LOG_BASAL: {
            value: 2,
            name: 'Log Basal',
            max: 2232,
            type: 'log',
            struct: 's2ib.',
            fields: [
                'crc',
                'DateTime',
                'SeqNmbr',
                'ClicksDelivered'
            ]
        },
    
        LOG_BASAL_CONFIG: {
            value: 3,
            name: 'Log Basal Config',
            max: 400,
            type: 'log',
            struct: 's2ib.shb8zb3sb.ib.',
            fields: [
                'crc',
                'DateTime',
                'SeqNmbr',
                'EventType',
                '0_ActProfile',
                '0_Tot24Hour',
                '0_ProfileEvt',
                '0_Name',
                '0_ProfileNmbr',
                '1_Percent',
                '1_DurProgrammed',
                '1_DurFinal',
                '1_CompletionCode',
                '2_RestartTime',
                '2_Cause'
            ]
        },
    
        LOG_ALARM_ALERT: {
            value: 4,
            name: 'Log Alarm Alert',
            max: 400,
            type: 'log',
            struct: 's3i2h2b',
            fields: [
                'crc',
                'DateTime',
                'SeqNmbr',
                'AckTime',
                'Qualifier1',
                'Qualifier2',
                'Event',
                'AckCause'
            ]
        },
    
        LOG_PRIME: {
            value: 5,
            name: 'Log Prime',
            max: 128,
            type: 'log',
            struct: 's2i2s2b',
            fields: [
                'crc',
                'DateTime',
                'SeqNmbr',
                'ClicksRequested',
                'ClicksDelivered',
                'CompletionCode',
                'Type'
            ]
        },
    
        LOG_PUMP: {
            value: 6,
            name: 'Log Pump',
            max: 512,
            type: 'log',
            struct: 's4ih2b',
            fields: [
                'crc',
                'DateTime',
                'SeqNmbr',
                'pbSerNumCm',
                'pbSerNumRtc',
                'InsulinVolume',
                'ConnectionType',
                'VersionState'
            ]
        },
    
        LOG_MISSED_BASAL: {
            value: 7,
            name: 'Log Missed Basal',
            max: 256,
            type: 'log',
            struct: 's3isb.',
            fields: [
                'crc',
                'DateTime',
                'SeqNmbr',
                'StartOfSuspension',
                'ClicksMissed',
                'ReasonsForStopping'
            ]
        },
    
        LOG_TIME_EDITS: {
            value: 8,
            name: 'Log Time Edits',
            max: 64,
            type: 'log',
            struct: 's3ib.',
            fields: [
                'crc',
                'DateTime',
                'SeqNmbr',
                'UserSetTime',
                'Flags'
            ]
        },
    
        USER_SETTINGS: {
            value: 9,
            name: 'User Settings',
            max: 1,
            type: 'settings',
            struct: 's2hs32h2s7h8z22h8z22h8z22h8z23hs8hs30z2hs30z2hs30z2hs30z2hs30z6hs3hs30z30z30z',
            fields: [
                'crc',
                'SmartBolusEnable',
                'SmartBolusInitialized',
                'BGUnitsType',
                'FoodProfile.StartTime[0]',
                'FoodProfile.CarbRatio[0]',
                'FoodProfile.StartTime[1]',
                'FoodProfile.CarbRatio[1]',
                'FoodProfile.StartTime[2]',
                'FoodProfile.CarbRatio[2]',
                'FoodProfile.StartTime[3]',
                'FoodProfile.CarbRatio[3]',
                'FoodProfile.StartTime[4]',
                'FoodProfile.CarbRatio[4]',
                'FoodProfile.StartTime[5]',
                'FoodProfile.CarbRatio[5]',
                'FoodProfile.StartTime[6]',
                'FoodProfile.CarbRatio[6]',
                'FoodProfile.StartTime[7]',
                'FoodProfile.CarbRatio[7]',
                'BGProfile.StartTime[0]',
                'BGProfile.BGRatio[0]',
                'BGProfile.StartTime[1]',
                'BGProfile.BGRatio[1]',
                'BGProfile.StartTime[2]',
                'BGProfile.BGRatio[2]',
                'TargetBG.StartTime[0]',
                'TargetBG.MinBG[0]',
                'TargetBG.MaxBG[0]',
                'TargetBG.StartTime[1]',
                'TargetBG.MinBG[1]',
                'TargetBG.MaxBG[1]',
                'TargetBG.StartTime[2]',
                'TargetBG.MinBG[2]',
                'TargetBG.MaxBG[2]',
                'InsulinAction',
                'IOBMode',
                'BolusButtonSelect',
                'ComboBolusEnable',
                'TimedBolusEnable',
                'BolusReminderEnable',
                'BolusStepSize',
                'AudioBolusStepSize',
                'BolusLimit',
                'ActiveProfile',
                'BasalProfile[0].Name',
                'BasalProfile[0].SegmentCount',
                'BasalProfile[0].Total24Hour',
                'BasalProfile[0].Segment[0].StartTime',
                'BasalProfile[0].Segment[0].Amount',
                'BasalProfile[0].Segment[1].StartTime',
                'BasalProfile[0].Segment[1].Amount',
                'BasalProfile[0].Segment[2].StartTime',
                'BasalProfile[0].Segment[2].Amount',
                'BasalProfile[0].Segment[3].StartTime',
                'BasalProfile[0].Segment[3].Amount',
                'BasalProfile[0].Segment[4].StartTime',
                'BasalProfile[0].Segment[4].Amount',
                'BasalProfile[0].Segment[5].StartTime',
                'BasalProfile[0].Segment[5].Amount',
                'BasalProfile[0].Segment[6].StartTime',
                'BasalProfile[0].Segment[6].Amount',
                'BasalProfile[0].Segment[7].StartTime',
                'BasalProfile[0].Segment[7].Amount',
                'BasalProfile[0].Segment[8].StartTime',
                'BasalProfile[0].Segment[8].Amount',
                'BasalProfile[0].Segment[9].StartTime',
                'BasalProfile[0].Segment[9].Amount',
                'BasalProfile[1].Name',
                'BasalProfile[1].SegmentCount',
                'BasalProfile[1].Total24Hour',
                'BasalProfile[1].Segment[0].StartTime',
                'BasalProfile[1].Segment[0].Amount',
                'BasalProfile[1].Segment[1].StartTime',
                'BasalProfile[1].Segment[1].Amount',
                'BasalProfile[1].Segment[2].StartTime',
                'BasalProfile[1].Segment[2].Amount',
                'BasalProfile[1].Segment[3].StartTime',
                'BasalProfile[1].Segment[3].Amount',
                'BasalProfile[1].Segment[4].StartTime',
                'BasalProfile[1].Segment[4].Amount',
                'BasalProfile[1].Segment[5].StartTime',
                'BasalProfile[1].Segment[5].Amount',
                'BasalProfile[1].Segment[6].StartTime',
                'BasalProfile[1].Segment[6].Amount',
                'BasalProfile[1].Segment[7].StartTime',
                'BasalProfile[1].Segment[7].Amount',
                'BasalProfile[1].Segment[8].StartTime',
                'BasalProfile[1].Segment[8].Amount',
                'BasalProfile[1].Segment[9].StartTime',
                'BasalProfile[1].Segment[9].Amount',
                'BasalProfile[2].Name',
                'BasalProfile[2].SegmentCount',
                'BasalProfile[2].Total24Hour',
                'BasalProfile[2].Segment[0].StartTime',
                'BasalProfile[2].Segment[0].Amount',
                'BasalProfile[2].Segment[1].StartTime',
                'BasalProfile[2].Segment[1].Amount',
                'BasalProfile[2].Segment[2].StartTime',
                'BasalProfile[2].Segment[2].Amount',
                'BasalProfile[2].Segment[3].StartTime',
                'BasalProfile[2].Segment[3].Amount',
                'BasalProfile[2].Segment[4].StartTime',
                'BasalProfile[2].Segment[4].Amount',
                'BasalProfile[2].Segment[5].StartTime',
                'BasalProfile[2].Segment[5].Amount',
                'BasalProfile[2].Segment[6].StartTime',
                'BasalProfile[2].Segment[6].Amount',
                'BasalProfile[2].Segment[7].StartTime',
                'BasalProfile[2].Segment[7].Amount',
                'BasalProfile[2].Segment[8].StartTime',
                'BasalProfile[2].Segment[8].Amount',
                'BasalProfile[2].Segment[9].StartTime',
                'BasalProfile[2].Segment[9].Amount',
                'BasalProfile[3].Name',
                'BasalProfile[3].SegmentCount',
                'BasalProfile[3].Total24Hour',
                'BasalProfile[3].Segment[0].StartTime',
                'BasalProfile[3].Segment[0].Amount',
                'BasalProfile[3].Segment[1].StartTime',
                'BasalProfile[3].Segment[1].Amount',
                'BasalProfile[3].Segment[2].StartTime',
                'BasalProfile[3].Segment[2].Amount',
                'BasalProfile[3].Segment[3].StartTime',
                'BasalProfile[3].Segment[3].Amount',
                'BasalProfile[3].Segment[4].StartTime',
                'BasalProfile[3].Segment[4].Amount',
                'BasalProfile[3].Segment[5].StartTime',
                'BasalProfile[3].Segment[5].Amount',
                'BasalProfile[3].Segment[6].StartTime',
                'BasalProfile[3].Segment[6].Amount',
                'BasalProfile[3].Segment[7].StartTime',
                'BasalProfile[3].Segment[7].Amount',
                'BasalProfile[3].Segment[8].StartTime',
                'BasalProfile[3].Segment[8].Amount',
                'BasalProfile[3].Segment[9].StartTime',
                'BasalProfile[3].Segment[9].Amount',
                'BasalLimit',
                'TimeFormat',
                'BGReminderEnable',
                'BGReminderTime',
                'LowInsulinEnable',
                'LowInsulinLevel',
                'NotificationTiming',
                'DeliveryLimit',
                'DailyAlert[0].Enable',
                'DailyAlert[0].Time',
                'DailyAlert[0].Frequency',
                'DailyAlert[0].Text',
                'DailyAlert[1].Enable',
                'DailyAlert[1].Time',
                'DailyAlert[1].Frequency',
                'DailyAlert[1].Text',
                'DailyAlert[2].Enable',
                'DailyAlert[2].Time',
                'DailyAlert[2].Frequency',
                'DailyAlert[2].Text',
                'DailyAlert[3].Enable',
                'DailyAlert[3].Time',
                'DailyAlert[3].Frequency',
                'DailyAlert[3].Text',
                'DailyAlert[4].Enable',
                'DailyAlert[4].Time',
                'DailyAlert[4].Frequency',
                'DailyAlert[4].Text',
                'AutoOff.Enable',
                'AutoOff.Duration',
                'PumpReminder.Enable',
                'PumpReminder.Hours',
                'TargetBGMin',
                'TargetBGMax',
                'BeepVolume',
                'ButtonGuardEnable',
                'SplashScreenEnable',
                'FlashlightEnable',
                'ScreenTimeout',
                'SplashScreenText,Line1',
                'SplashScreenText,Line2',
                'SplashScreenText,Line3'
            ]
        },
    
        TIME_MANAGER_DATA: {
            value: 10,
            name: 'Time Manager Data',
            max: 1,
            type: 'settings',
            struct: 's2is',
            fields: [
                'Crc',
                'RtcAtSetTime',
                'UserSetTime',
                'UserTimeFlag'
            ]
        },
    
    }

};
