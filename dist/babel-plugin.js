"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function globalVar(scope, name) {
  if (name in scope.globals) {
    return true;
  } else if (scope.parent === null) {
    return false;
  } else {
    return globalVar(scope.parent, name);
  }
}

function _default(_ref) {
  var t = _ref.types;
  return {
    visitor: {
      Identifier: function Identifier(path, state) {
        if (path.parent.type == 'MemberExpression' && path.parent.object != path.node) {
          return;
        }

        if (globalVar(path.scope, path.node.name) && !(path.node.name in global)) {
          path.replaceWith(t.memberExpression(t.identifier("locals"), path.node));
        }
      }
    }
  };
}

;
