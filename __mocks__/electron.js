const electron = jest.genMockFromModule('electron');

function getGlobal(string) {
    if (string === 'i18n') {
        return { t: (string) => string };
    }
}

electron.remote = { getGlobal };
electron.ipcRenderer = {send: () => null, on: () => null};

module.exports = electron;
