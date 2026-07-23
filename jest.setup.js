// Interpolating, key-returning translation function, matching the behaviour
// tests relied on when they ran inside Electron with the i18n global mocked.
const mockT = (str, obj = {}) => {
  const keys = Object.keys(obj);
  let replacedStr = str;
  for (const key of keys) {
    const re = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    replacedStr = replacedStr.replace(re, obj[key]);
  }
  return replacedStr;
};

jest.mock('@electron/remote', () => {
  const mockI18n = {
    t: jest.fn(mockT),
  };

  return {
    getGlobal: jest.fn(() => mockI18n),
  };
});

// Modules that run outside Electron fall back to requiring i18next directly,
// which is never initialized in tests.
jest.mock('i18next', () => {
  const mockI18n = {
    t: jest.fn(mockT),
  };
  mockI18n.default = mockI18n;
  return mockI18n;
});

// idb-keyval needs indexedDB, which Electron's renderer provided and Node lacks.
jest.mock('idb-keyval', () => ({
  get: jest.fn(() => Promise.resolve(undefined)),
  set: jest.fn(() => Promise.resolve()),
  del: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  keys: jest.fn(() => Promise.resolve([])),
}));

// Node's navigator global lacks userAgentData, which Chromium provides in Electron.
const mockUAPlatform = { darwin: 'macOS', win32: 'Windows' }[process.platform] || 'Linux';
Object.defineProperty(globalThis.navigator, 'userAgentData', {
  value: {
    platform: mockUAPlatform,
    getHighEntropyValues: () => Promise.resolve({
      platform: mockUAPlatform,
      platformVersion: '10.0.0',
      bitness: '64',
    }),
  },
  configurable: true,
});
