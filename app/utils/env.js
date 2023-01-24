import isElectron from 'is-electron';

const is_electron = isElectron();
const isRenderer = process && process.type === 'renderer';
const isBrowser =
  typeof window !== 'undefined' && typeof window.document !== 'undefined';
const isNode =
  typeof process !== 'undefined' &&
  process.versions != null &&
  process.versions.node != null;

export default {
  electron: is_electron,
  electron_main: is_electron && !isRenderer,
  electron_renderer: is_electron && isRenderer,
  browser: !is_electron && isBrowser,
  node: isNode,
};
