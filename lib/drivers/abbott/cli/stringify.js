// a wrapper around JSON.stringify to allow for more control over the formatting of the JSON

export function stringify(obj, options) {

  var stringOrChar = /("(?:[^\\"]|\\.)*")|[:,]/g;

  function prettify (string) {
    return string.replace(stringOrChar, function (match, string) {
      return string ? match : match + ' ';
    });
  }

  function get (options, name, defaultValue) {
    return (name in options ? options[name] : defaultValue);
  }

  options = options || {};
  var indent = JSON.stringify([1], null, get(options, 'indent', 2)).slice(2, -3);
  var maxLength = (indent === '' ? Infinity : get(options, 'maxLength', 80));
  var maxLevelPretty = get(options, 'maxLevelPretty', Infinity);

  return (function _stringify (obj, currentIndent, reserved) {
    if (obj && typeof obj.toJSON === 'function') {
      obj = obj.toJSON();
    }

    var string = JSON.stringify(obj);

    if (string === undefined) {
      return string;
    }

    var currentLevel = currentIndent.length / indent.length;
    if (currentLevel >= maxLevelPretty) {
      return string;
    }

    var length = maxLength - currentIndent.length - reserved;

    if (string.length <= length) {
      var prettified = prettify(string);
      if (prettified.length <= length) {
        return prettified;
      }
    }

    if (typeof obj === 'object' && obj !== null) {
      var nextIndent = currentIndent + indent;
      var items = [];
      var delimiters;
      var comma = function (array, index) {
        return (index === array.length - 1 ? 0 : 1);
      };

      if (Array.isArray(obj)) {
        for (var index = 0; index < obj.length; index++) {
          items.push(
            _stringify(obj[index], nextIndent, comma(obj, index)) || 'null'
          );
        }
        delimiters = '[]';
      } else {
        Object.keys(obj).forEach(function (key, index, array) {
          var keyPart = JSON.stringify(key) + ': ';
          var value = _stringify(obj[key], nextIndent,
            keyPart.length + comma(array, index));
          if (value !== undefined) {
            items.push(keyPart + value);
          }
        });
        delimiters = '{}';
      }

      if (items.length > 0) {
        return [
          delimiters[0],
          indent + items.join(',\n' + nextIndent),
          delimiters[1]
        ].join('\n' + currentIndent);
      }
    }

    return string;
  })(obj, '', 0);
}
