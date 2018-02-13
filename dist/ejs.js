"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.transform = transform;
exports.compile = compile;
exports.render = render;
exports.options = void 0;

var babel = _interopRequireWildcard(require("@babel/core"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

var overrides = {};
exports.options = overrides;
var _DEFAULT_OPTIONS = {
  openTag: '<%',
  closeTag: '%>',
  closeTagRegex: undefined,
  openTagModifiers: {
    output: '=',
    comment: '#',
    literal: '%'
  },
  closeTagModifiers: {
    trim: '-',
    literal: '%'
  }
};

function charsBalanced(str, chars) {
  var a = chars[0];
  var b = chars[1];
  str = str.replace(/"(\\.|[^"])+"/, '');
  str = str.replace(/'(\\.|[^'])+'/, '');
  var aCount = (str.match(new RegExp("\\".concat(a), 'g')) || []).length;
  var bCount = (str.match(new RegExp("\\".concat(b), 'g')) || []).length;
  return aCount - bCount;
}

function digest(source, options, callback) {
  var openTagCount = 0,
      closeTagCount = 0;
  var index, tagType, tagLength, tagModifier, tagModifiers, matchingModifier, prefix;
  var lastTagModifier;
  var nextOpenIndex = source.indexOf(options.openTag);
  var nextCloseIndex = source.indexOf(options.closeTag);

  while (nextOpenIndex != -1 || nextCloseIndex != -1) {
    if (nextCloseIndex !== -1 && (nextOpenIndex === -1 || nextCloseIndex < nextOpenIndex)) {
      index = nextCloseIndex;
      tagType = 'close';
      tagLength = options.closeTag.length;
      tagModifiers = options.closeTagModifiers;
      closeTagCount += 1;
      matchingModifier = Object.entries(tagModifiers).find(function (m) {
        return source.substr(index - m[1].length, m[1].length) === m[1];
      });
    } else {
      index = nextOpenIndex;
      tagType = 'open';
      tagLength = options.openTag.length;
      tagModifiers = options.openTagModifiers;
      openTagCount += 1;
      matchingModifier = Object.entries(tagModifiers).find(function (m) {
        return source.substr(index + tagLength, m[1].length) === m[1];
      });
    }

    if (matchingModifier) {
      tagLength += matchingModifier[1].length;
      tagModifier = matchingModifier[0];
    } else {
      tagModifier = 'default';
    } // console.log(source, nextOpenIndex, nextCloseIndex, tagLength, tagType, tagModifier)


    if (tagModifier === 'literal') {
      if (tagType === 'open') {
        source = source.slice(0, index + tagLength - matchingModifier[1].length) + source.slice(index + tagLength);
        openTagCount -= 1;
      } else {
        closeTagCount -= 1;

        if (index === 0) {
          source = source.slice(index + matchingModifier[1].length);
        } else {
          source = source.slice(0, index) + source.slice(index + matchingModifier[1].length);
        }
      }

      nextOpenIndex = source.indexOf(options.openTag, index + tagLength - matchingModifier[1].length);
      nextCloseIndex = source.indexOf(options.closeTag, index + tagLength - matchingModifier[1].length);
      continue;
    }

    if (index !== 0) {
      if (tagType === 'close' && options.closeTagBalance) {
        prefix = source.substring(0, index + tagLength);

        if (charsBalanced(prefix, options.closeTagBalance) === 0) {
          nextOpenIndex = source.indexOf(options.openTag, index + tagLength);
          nextCloseIndex = source.indexOf(options.closeTag, index + tagLength);
          continue;
        } else {
          callback(source.substring(0, index), 'js', lastTagModifier);
          source = source.slice(index);
        }
      } else {
        if (tagType === 'close') {
          if (matchingModifier !== undefined) {
            callback(source.substring(0, index - matchingModifier[1].length), 'js', lastTagModifier);
          } else {
            callback(source.substring(0, index), 'js', lastTagModifier);
          }
        } else {
          callback(source.substring(0, index), 'text', lastTagModifier);
        }

        source = source.slice(index);
      }
    }

    if (tagType === 'close' && matchingModifier !== undefined) {
      source = source.slice(tagLength - matchingModifier[1].length); // console.log('---', source, '---')

      source = source.trimLeft(); // console.log('---', source, '---')
    } else {
      source = source.slice(tagLength);
    }

    nextOpenIndex = source.indexOf(options.openTag);
    nextCloseIndex = source.indexOf(options.closeTag);
    lastTagModifier = tagModifier;
  }

  if (openTagCount !== closeTagCount) {
    throw new Error("Could not find closing tag for \"".concat(options[tagType + 'Tag'], "\"."));
  }

  callback(source, 'text', tagModifier);
}

function functionSource(source, options) {
  var output = '';
  var stack = [];
  output += "var __output = [];\n";
  output += "function __append(s) { if (s !== undefined && s != null) { __output.push(String(s)); } }\n"; // output += `    with (locals || {}) {\n`

  digest(source, options, function (segment, type, modifier) {
    // console.log(type, modifier, segment);
    if (type == 'js') {
      if (modifier === 'comment') {// do nothing
      } else if (segment.match(/^\s*\}/)) {
        var last = stack.pop();

        if (last === 'output') {
          output += "    return __output.join(\"\");\n" + segment + '\n);\n';
        } else {
          output += segment + '\n';
        }
      } else {
        if (modifier == 'output') {
          if (segment.match(/\{\s*$/)) {
            output += '__append(' + segment + '\n';
            output += "var __output = [];\n";
            output += "function __append(s) { if (s !== undefined && s != null) { __output.push(String(s)); } }\n";
            stack.push(modifier);
          } else {
            output += '__append(' + segment + '\n);\n';
          }
        } else {
          if (segment.match(/\{\s*$/)) {
            stack.push(modifier);
          }

          output += segment + '\n';
        }
      }
    } else if (segment.length > 0) {
      output += '__append(`' + segment.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '`);\n';
    }
  }); // output += `    }\n`

  output += "    return __output.join(\"\");\n";
  return output;
}

function defaultOptions(options) {
  if (options === undefined) {
    options = {};
  }

  Object.keys(_DEFAULT_OPTIONS).forEach(function (key) {
    if (!(key in options)) {
      options[key] = overrides[key] || _DEFAULT_OPTIONS[key];
    }
  });
  ['openTagModifiers', 'closeTagModifiers'].forEach(function (key) {
    Object.keys(_DEFAULT_OPTIONS[key]).forEach(function (subkey) {
      if (!(subkey in options[key])) {
        if (key in overrides && subkey in overrides[key]) {
          options[key][subkey] = overrides[key][subkey];
        } else {
          options[key][subkey] = _DEFAULT_OPTIONS[key][subkey];
        }
      }
    });
  });
  return options;
}

function transform(source, options) {
  options = defaultOptions(options);
  var output = 'export default function (locals) {\n';
  output += functionSource(source, options);
  output += '\n}';
  return babel.transform(output, {
    plugins: [__dirname + '/babel-plugin'],
    inputSourceMap: options.inputSourceMap,
    ast: false
  });
}

function compile(source, options) {
  options = defaultOptions(options);
  var output = 'function f(locals) {\n';
  output += functionSource(source, options);
  output += '\n}';
  output = babel.transform(output, {
    plugins: [__dirname + '/babel-plugin'],
    ast: false
  }).code;
  output = output.substring(output.indexOf("\n"), output.lastIndexOf("\n"));
  return new Function('locals', output);
}

function render(source, data, options) {
  if (options && options.context) {
    return compile(source, options).call(options.context, data);
  } else {
    return compile(source, options)(data);
  }
}
