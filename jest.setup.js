jest.mock('@electron/remote', () => {
  const mockI18n = {
    t: jest.fn(
      (str, obj = {}) => {
        const keys = Object.keys(obj);
        let replacedStr = str;
        for (const key of keys) {
          console.log(key);
          const re = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
          replacedStr = replacedStr.replace(re, obj[key]);
        }
        return replacedStr;
      }
    )
  };

  return {
    getGlobal: jest.fn(() => mockI18n),
  };
});
