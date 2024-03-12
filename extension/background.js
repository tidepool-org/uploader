/**
 * Copyright (c) 2024, Tidepool Project
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
 */

let reply = undefined;
let port = undefined;

/* global chrome */

function connect() {
    const hostName = 'org.tidepool.uploader-helper';
    console.log('Connecting to native messaging host', hostName);
    port = chrome.runtime.connectNative(hostName);
    port.onMessage.addListener(onNativeMessage);
    port.onDisconnect.addListener(onDisconnected);
}

function sendNativeMessage(message) {
    port.postMessage(message);
    console.log('Sent message:', JSON.stringify(message));
}
  
function onNativeMessage(message) {
	if (message.msgType == 'info') {
    	console.log(message.details);
    } else {
 		reply(message);
 	}
}
  
function onDisconnected() {
    console.log('Disconnected: ' + chrome.runtime.lastError.message);
    port = null;
    reply({ msgType: 'error', details: 'Disconnected: ' + chrome.runtime.lastError.message });
}

chrome.runtime.onMessageExternal.addListener(
    function(request, sender, sendResponse) {
        console.log('Received message from the web page:', request);

        if (!port) {
        	connect();
        }
        
        // Process the request here
        if (port) {
	        sendNativeMessage(request);

	        reply = sendResponse;
	        return true; // indicates we will asynchronously use sendResponse
	    } else {
	    	sendResponse({ msgType: 'error', details: 'Not connected.'});
	    }
    }
);
