let i18nextOptions = module.exports = {
  backend:{
    loadPath: './locales/{{lng}}/{{ns}}.json',
    addPath: './locales/{{lng}}/{{ns}}.missing.json'
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
  react: {
    wait: true,
    withRef: true,
    defaultTransParent: 'div'
  }
};
