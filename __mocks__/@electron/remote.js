const i18n = {
  t: jest.fn((key) => key),
};

module.exports = {
  getGlobal: jest.fn(() => i18n),
};
