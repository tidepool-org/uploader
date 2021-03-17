const electron = jest.genMockFromModule('electron');

function getGlobal(string) {
    if (string === 'i18n') {
        return { t: (string) => string };
    }
}

electron.remote = { getGlobal };

module.exports = electron;
