// Interpolating, key-returning translation function, matching the behaviour
// tests relied on when they ran inside Electron with the i18n global mocked.
module.exports = (str, obj = {}) => {
  const keys = Object.keys(obj);
  let replacedStr = str;
  for (const key of keys) {
    const re = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    replacedStr = replacedStr.replace(re, obj[key]);
  }
  return replacedStr;
};
