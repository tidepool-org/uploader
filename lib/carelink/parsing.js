/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 * 
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */
'use strict';

var util = require('util');

var _ = require('lodash');

function error() {
  throw new Error(util.format.apply(util.format, Array.prototype.slice.call(arguments, 0)));
}

/**
 * Generates a function that will extract the specified field out of objects passed into it.
 *
 * The field parameter can be an array which allows for extracted nested fields.  Field names are
 * applied in array order.
 *
 * @param field a string or array of strings
 * @returns {Function} a function that will extract the given field from objects passed into it.
 */
exports.extract = function(field) {
  if (Array.isArray(field)) {
    return function(e) {
      var retVal = e;
      for (var i = 0; i < field.length; ++i) {
        retVal = retVal[field[i]];
      }
      return retVal;
    };
  }

  return function(e) {
    return e[field];
  };
};

function defaultFieldFn(fieldFn) {
  if (typeof fieldFn === 'function') {
    return fieldFn;
  }
  return exports.extract(fieldFn);
}

exports.annotate = function() {
  var codes = [arguments.length];
  for (var i = 0; i < arguments.length; ++i) {
    var ann = arguments[i];
    codes[i] = typeof(ann) === 'string' ? { code: ann } : ann;
  }

  return function(e) {
    return codes;
  };
};

/**
 * Extracts the provided fields (see extract()) and converts them to a Number.
 *
 * @param fieldFn a function that can extract a field, or an object that can be passed to extract()
 * @param defaultVal optional, the value to return when the field is null
 * @returns {Function} a function that will extract the given field and convert it to a number when passed an object
 */
exports.asNumber = function(fieldFn, defaultVal) {
  return exports.map(fieldFn, function(e) {
    if (e == null) {
      if (defaultVal == null) {
        return null;
      }

      e = defaultVal;
    }

    var retVal = Number(e);
    if (retVal == null || Number.isNaN(retVal)) {
      error('Expected field[%s] to be a number, it was[%s].', fieldFn, e);
    }
    return  retVal;
  });
};

/**
 * Extracts the provided fields (see extract()) and lower cases them.
 *
 * @param fieldFn a function that can extract a field, or an object that can be passed to extract()
 * @returns {Function} a function that will extract the given field and lower case it when passed an object
 */
exports.toLower = function(fieldFn) {
  return exports.map(fieldFn, function(e){
    return e == null ? null : e.toLowerCase();
  });
};

/**
 * Extracts the provided fields (see extract()) and applies the mapFn before returning
 *
 * @param fieldFn a function that can extract a field, or an object that can be passed to extract()
 * @param mapFn a function that converts the value from one thing to another
 * @returns {Function} a function that will extract the given field and return the result of the mapFn on that value
 */
exports.map = function(fieldFn, mapFn) {
  fieldFn = defaultFieldFn(fieldFn);

  return function(e) {
    return mapFn(fieldFn(e));
  };
};

function buildParserSpecs(spec) {
  var valueType = typeof(spec);

  if (valueType === 'string') {
    return function() {
      return spec;
    };
  } else if (Array.isArray(spec)) {
    var functions = spec.map(buildParserSpecs);

    return function(e) {
      return _.assign.apply(_, [{}].concat(functions.map(function(fn){ return fn(e); })));
    };
  } else if (valueType === 'object') {
    var fns = [];

    Object.keys(spec).forEach(function(key){
      var subFn = buildParserSpecs(spec[key]);
      fns.push(function(obj, event) {
        var val = subFn(event);
        if (val != null) {
          obj[key] = val;
        }
      });
    });

    return function(e){
      var retVal = {};
      fns.forEach(function(fn) {
        fn(retVal, e);
      });
      return retVal;
    };
  } else if (valueType === 'function') {
    return spec;
  }
  error('Unknown type[%s]', valueType);
}

/**
 * A parserBuilder is a helper object that can build up "object" parsers.
 *
 * The general pattern is that you call one of the `when` methods to specify a potential
 * parsing rule.  The `when` method will return a "rule builder" object that you call
 * methods on to configure what happens when the predicate on the `when` method is true.
 *
 * Call `build()` when you are done configuring the object and you will get a function
 * that will convert objects according to the provided rules.
 *
 * The function applies rule predicates in order and delegates to the first rule that
 * matches the object.
 *
 * @returns {{when: when, whenFieldIs: whenFieldIs, build: build}}
 */
exports.parserBuilder = function() {
  var rules = [];

  return {
    /**
     * Takes a predicate that defines when the rule is applied.
     *
     * @param predicate predicate function, true for rule applies
     * @returns {{apply: apply, applyConversion: applyConversion}} a "rule builder"
     */
    when: function(predicate) {
      var parentBuilder = this;
      var handler = {
        pred: predicate
      };
      rules.push(handler);

      return {
        /**
         * Applies the given parser function to the object.  If this has previously been called,
         * it chains or "composes" the functions such that they are applied in the order that `apply()`
         * is called.
         *
         * @param parserFn a function that converts an obj
         * @returns {exports} this object
         */
        apply: function(parserFn) {
          if (handler.parserFn == null) {
            handler.parserFn = parserFn;
          } else {
            handler.parserFn = _.compose(parserFn, handler.parserFn);
          }
          return this;
        },

        /**
         * Takes a more developer-friendly object representation of a conversion and builds a
         * parser function from it.  Then delegates to `apply()`.
         *
         * The developer friendly object can be a string, array, function or object.
         *
         * If it is a
         * * string - generate a function that always returns that string, no matter what input it is given
         * * array - recursively apply the conversion to each element of the array and return a function that combines
         *           the results of calling each of the conversion functions on the input object
         * * function - pass it through untouched
         * * object - generate a parser function that will generate each of the fields of the given object, where the
         *            values are the result of applying the function received by recursively applying the conversion
         *            to the value of the provided object.
         *
         * An example is
         *
         * ```
         * {
         *   _id: extract('id'),
         *   valA: [asNumber('aaAaa') ,function(e){ console.log('valA is', e); return e; }],
         *   payload: { valB: toLower('bB')
         *              valC: extract('bB') }
         * }
         * ```
         *
         * When passed in
         *
         * ```
         * { id: '123',
         *   aaAaa: '321'
         *   bB: 'AbCd'
         * }
         * ```
         *
         * Will produce
         *
         * ```
         * { _id: '123',
         *   valA: 321,
         *   payload: { valB: 'abcd',
         *              valC: 'AbCd' }
         * }
         * ```
         *
         * And will output the following line to the console
         *
         * ```
         * valA is 321
         * ```
         *
         * @param spec The specification of the parsing fn
         * @returns {exports} this object
         */
        applyConversion: function(spec) {
          return this.apply(buildParserSpecs(spec));
        },


        /**
         * Creates a new parserBuilder that applies when the previous rules apply
         *
         * @returns a new parserBuilder, on `build()` the returned parserBuilder will return the current "rule builder"
         */
        newBuilder: function() {
          var self = this;
          var retVal = exports.parserBuilder();

          var oldBuild = retVal.build.bind(retVal);
          retVal.build = function() {
            return self.apply(oldBuild());
          };

          return retVal;
        },

        /**
         * Signifies that you are done with the current "rule builder", returns the parent parserBuilder
         * to enable chaining of calls
         *
         * @returns the parent parserBuilder
         */
        done: function() {
          return parentBuilder;
        }
      };
    },

    /**
     * Builds a predicate of `field === value` and delegates to `when()`
     *
     * @param field field of object to check
     * @param value value to equate
     * @returns {{apply: apply, applyConversion: applyConversion}} a "rule builder"
     */
    whenFieldIs: function(field, value) {
      return this.when(function(e){
        return e[field] === value;
      });
    },

    /**
     * Builds a predicate of `field != null` and delegates to `when()`
     *
     * @param field field of object to check
     * @returns {{apply: apply, applyConversion: applyConversion}} a "rule builder"
     */
    whenFieldIsDefined: function(field) {
      return this.when(function(e){
        return e[field] != null;
      });
    },

    /**
     * Builds a function that will parse objects as configured
     *
     * @returns {Function} a function that takes an object and parses objects as configured
     */
    build: function() {
      for (var i = 0; i < rules.length; ++i) {
        if (rules[i].parserFn == null) {
          error('parserFn not defined on rule[%s], did you forget to call build()?', i);
        }
      }

      return function(e) {
        for (var i = 0; i < rules.length; ++i) {
          var rule = rules[i];
          if (rule.pred(e)) {
            return rule.parserFn(e);
          }
        }
        return null;
      };
    }
  };
};