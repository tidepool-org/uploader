
let reply;
let port;

/* global chrome */

function connect() {
    const hostName = 'org.tidepool.uploader';
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

        if (request.command == 'openDevice') {
        	connect();
        }
        
        // Process the request here
        if (port) {
	        sendNativeMessage(request);

	        reply = sendResponse;
	        return true; // indicates you will asynchronously use sendResponse
	    } else {
	    	sendResponse({ msgType: 'error', details: 'Not connected.'});
	    }
    }
);
