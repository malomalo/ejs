function globalVar(scope, name) {
  if (name in scope.globals) {
    return true;
  } else if (scope.parent === null) {
    return false;
  } else {
    return globalVar(scope.parent, name);
  }
}

export default function({ types: t }) {
  return {
    visitor: {
      Identifier(path, state) {
        if ( path.parent.type == 'MemberExpression' && path.parent.object != path.node) {
          return;
        }

        if (globalVar(path.scope, path.node.name) && !(path.node.name in global)) {
          path.replaceWith(
            t.memberExpression(t.identifier("locals"), path.node)
          );
        }
      }
    }
  };
};