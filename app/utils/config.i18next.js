const i18nextOptions = module.exports = {
  backend:{
    loadPath: './locales/{{lng}}/{{ns}}.json',
    addPath: './locales/{{lng}}/{{ns}}.missing.json'
  },
  interpolation: {
    escapeValue: false
  },
  lng: "es",
  saveMissing: true,
  fallbackLng: "es",
  returnEmptyString: false,
  whitelist: ["en", "es"],
  react: {
    wait: true,
    withRef: true,
    defaultTransParent: 'div'
  }
};
