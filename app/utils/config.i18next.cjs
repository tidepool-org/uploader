const env = require('./env.js');
const { initReactI18next } = require('react-i18next');
const _  = require('lodash');

let i18n;
let i18nextOptions = {};
let setLanguage;

if (env.electron_main) {
  i18n = require('i18next');

  if(i18n.default) {
    i18n = i18n.default;
  }

  const { app } = require('electron');
  let i18nextBackend = require('i18next-fs-backend/cjs');

  if(i18nextBackend.default) {
    i18nextBackend = i18nextBackend.default;
  }

  var path = require('path');

  let dirPath =
    process.env.NODE_ENV === 'production' ? path.join(__dirname, '../') : '.';
  i18nextOptions = {
    backend: {
      loadPath: dirPath + '/locales/{{lng}}/{{ns}}.json',
      addPath: dirPath + '/locales/{{lng}}/{{ns}}.missing.json',
    },
    interpolation: {
      escapeValue: false,
    },
    lng: 'en',
    saveMissing: true,
    fallbackLng: 'en',
    returnEmptyString: false,
    supportedLngs: ['en', 'es'],
    keySeparator: false,
    nsSeparator: '|',
    debug: false,
    wait: true,
  };

  setLanguage = (cb) => {
    cb ??= _.noop;
    if (process.env.I18N_ENABLED === 'true') {
      let lng = app.getLocale();
      // remove country in language locale
      if (_.includes(lng, '-'))
        lng = _.split(lng, '-').length > 0 ? _.split(lng, '-')[0] : lng;

      i18nextOptions['lng'] = lng;
    }

    if (!i18n.isInitialized) {
      i18n
        .use(initReactI18next)
        .use(i18nextBackend)
        .init(i18nextOptions, function(err, t) {
          if (err) {
            console.log('An error occurred in i18next:', err);
          }

          global.i18n = i18n;
          cb();
        });
    } else {
      i18n.changeLanguage(i18nextOptions.lng).then(() => {
        cb();
      });
    }
  };

  setLanguage();
} else {
  if (env.electron_renderer) {
    const remote = require('@electron/remote');
    i18n = remote.getGlobal('i18n');
  }
}

if (env.browser && !env.electron_renderer) {
  i18n = require('i18next').default;
  i18nextOptions = {
    // backend: {
    //   loadPath: './locales/{{lng}}/{{ns}}.json',
    //   addPath: './locales/{{lng}}/{{ns}}.missing.json',
    // },
    interpolation: {
      escapeValue: false,
    },
    lng: 'en',
    saveMissing: true,
    fallbackLng: 'en',
    returnEmptyString: false,
    supportedLngs: ['en', 'es'],
    keySeparator: false,
    nsSeparator: '|',
    debug: false,
    wait: true,
    fallbackLng: 'en',

    // To allow . in keys
    keySeparator: false,
    // To allow : in keys
    nsSeparator: '|',

    debug: false,

    interpolation: {
      escapeValue: false, // not needed for react!!
    },

    // If the translation is empty, return the key instead
    returnEmptyString: false,

    react: {
      wait: true,
      withRef: true,
      // Needed for react < 16
      defaultTransParent: 'div',
    },

    resources: {
      en: {
        // Default namespace
        translation: require('../../locales/en/translation.json'),
      },
      es: {
        // Default namespace
        translation: require('../../locales/es/translation.json'),
      },
    },
  };

  let setLanguage = (cb) => {
    cb ??= _.noop;
    if (process.env.I18N_ENABLED === 'true') {
      let lng = navigator.language;
      // remove country in language locale
      if (_.includes(lng, '-'))
        lng = _.split(lng, '-').length > 0 ? _.split(lng, '-')[0] : lng;

      i18nextOptions['lng'] = lng;
    }

    if (!i18n.isInitialized) {
      i18n.use(initReactI18next).init(i18nextOptions, function(err, t) {
        if (err) {
          console.log('An error occurred in i18next:', err);
        }
        global.i18n = i18n;
        cb();
      });
    } else {
      i18n.changeLanguage(i18nextOptions.lng).then(() => {
        cb();
      });
    }
  };

  setLanguage();
}

module.exports = { i18nextOptions, setLanguage, i18n };
