const remote = jest.genMockFromModule('@electron/remote');

remote.getGlobal = function getGlobal(string) {
    if (string === 'i18n') {
        return { t: (string) => string };
    }
};

module.exports = remote;
