#!/usr/bin/env osascript -l JavaScript

/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2020, Tidepool Project
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

/* eslint-disable */

ObjC.import('stdlib')

const app = Application.currentApplication()
app.includeStandardAdditions = true

function showDialog() {
  return app.displayDialog('Please enter your computer password to allow Tidepool Uploader to access your device.', {
    defaultAnswer: '',
    withIcon: 'note',
    buttons: ['Cancel', 'Why do I need to do this?', 'OK'],
    defaultButton: 'OK',
    hiddenAnswer: true,
  })
}

showDialog()

if (result.buttonReturned === 'OK') {
  result.textReturned
} else if (result.buttonReturned === 'Why do I need to do this?') {
  app.openLocation('https://tidepool.org/') // TODO: needs link to support article
  showDialog()
} else {
  $.exit(255)
}
