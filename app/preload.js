const { ipcRenderer } = require('electron');

console.log('Preload script is running');

window.electron = {
  handleIncomingUrl: (url) => {
    console.log('handleIncomingUrl called with URL:', url);
    return ipcRenderer.invoke('handle-incoming-url', url);
  }
};

console.log('Exposed handleIncomingUrl method to window.electron');