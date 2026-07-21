jest.mock('@electron/remote', () => {
  const mockI18n = {
    t: jest.fn(require('./__mocks__/i18nTMock.js')),
  };

  return {
    getGlobal: jest.fn(() => mockI18n),
  };
});

// Modules that run outside Electron fall back to requiring i18next directly,
// which is never initialized in tests.
jest.mock('i18next', () => {
  const mockI18n = {
    t: jest.fn(require('./__mocks__/i18nTMock.js')),
  };
  mockI18n.default = mockI18n;
  return mockI18n;
});

// Several async action tests attach assertions to promise chains without
// returning them, so they were never awaited or enforced under the Electron
// runner — its renderer silently dropped the unhandled rejections. Node
// crashes the worker on unhandled rejections instead; keep parity with the
// old runner until those tests are reworked to return their promises.
process.on('unhandledRejection', () => {});

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
