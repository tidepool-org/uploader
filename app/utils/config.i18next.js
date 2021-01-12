let path = (process.env.NODE_ENV === 'production') ? 'Resources': '.';
let i18nextOptions = module.exports = {
  backend: {
    loadPath: path + '/locales/{{lng}}/{{ns}}.json',
    addPath: path + '/locales/{{lng}}/{{ns}}.missing.json'
  },
  interpolation: {
    escapeValue: false
  },
  lng: 'en',
  saveMissing: true,
  fallbackLng: 'en',
  returnEmptyString: false,
  whitelist: ['en', 'es'],
  keySeparator: false,
  nsSeparator: '|',
  debug: false,
  wait: true
};
