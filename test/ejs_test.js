import path from 'path';
import assert from 'assert';
import * as ejs from '../lib/ejs';

describe('EJS', function() {
  
  it('allow custom tags', function () {
    var fn;

    fn = ejs.compile('<p><?= name ?></p>', {openTag: '<?', closeTag: '?>'});
    assert.equal(fn({name: 'geddy'}), '<p>geddy</p>');

    fn = ejs.compile('<p><:= name :></p>', {openTag: '<:', closeTag: ':>'});
    assert.equal(fn({name: 'geddy'}), '<p>geddy</p>');

    fn = ejs.compile('<p><$= name $></p>', {openTag: '<$', closeTag: '$>'});
    assert.equal(fn({name: 'geddy'}), '<p>geddy</p>');
  });

  it('defaults to using ejs.delimiter', function () {
    var fn;

    ejs.options.openTag = '<?';
    fn = ejs.compile('<p><?= name %></p>');
    assert.equal(fn({name: 'geddy'}), '<p>geddy</p>');

    fn = ejs.compile('<p><|= name %></p>', {openTag: '<|'});
    assert.equal(fn({name: 'geddy'}), '<p>geddy</p>');
    delete ejs.options.openTag;
  });

  it('supports "subtemplates"', function() {
    var formTag = function(template) {
      return '<form>' + template(1) + '</form>';
    }
    
    var template = `<%= formTag(function(f) { %><input value="<%= f %>"><% }) %>`
    
    assert.equal(ejs.render(template, {formTag: formTag}), '<form><input value="1"></form>');
  });
  
  describe('#transform()', function() {
  });

  describe('#compile()', function() {
  });

  describe('#render()', function() {
    it('render the template', function () {
      assert.equal(ejs.render('<p>yay</p>'), '<p>yay</p>');
    });

    it('empty input works', function () {
      assert.equal(ejs.render(''), '');
    });

    it('undefined renders nothing', function () {
      assert.equal(ejs.render('<%= undefined %>'), '');
    });

    it('null renders nothing', function () {
      assert.equal(ejs.render('<%= null %>'), '');
    });

    it('zero-value data item renders something', function () {
      assert.equal(ejs.render('<%= 0 %>'), '0');
    });

    it('accept locals', function () {
      assert.equal(ejs.render('<p><%= name %></p>', {name: 'geddy'}), '<p>geddy</p>');
    });

    it('opts.context', function () {
      var ctxt = {foo: 'FOO'};
      var out = ejs.render('<%= this.foo %>', {}, {context: ctxt});
      assert.equal(out, ctxt.foo);
    });
  });

  describe('<%', function () {
    it('without semicolons', function () {
      var source = `<%
  var a = 'b'
  var b = 'c'
  var c
  c = b
%>
The value of c is: <%= c %>`
      assert.equal(ejs.render(source), '\nThe value of c is: c');
    });
  });

  describe('<%=', function () {
    it('should not throw an error with a // comment on the final line', function () {
      assert.equal(ejs.render('<%=\n// a comment\nname\n// another comment %>', {name: '&nbsp;<script>'}),
        '&nbsp;<script>');
    });

    it('not escape', function () {
      assert.equal(ejs.render('<%= name %>', {name: '<script>'}),
        '<script>');
    });

    it('terminate gracefully if no close tag is found', function () {
      try {
        ejs.compile('<h1>oops</h1><%= name ->');
        throw new Error('Expected parse failure');
      }
      catch (err) {
        assert.ok(err.message.indexOf('Could not find closing tag for "<%".') > -1);
      }
    });
  });

  describe('%>', function () {
    it('produce newlines', function () {
      var template = `<ul>\n  <% users.forEach(function(user){ %>\n    <li><%= user %></li>\n  <% }) %>\n</ul>`
      var result = `<ul>\n  \n    <li>a</li>\n  \n    <li>b</li>\n  \n    <li>c</li>\n  \n</ul>`
      assert.equal(ejs.render(template, {users: ['a', 'b', 'c']}), result);
    });

    it('works with `-%>` interspersed', function () {
      var template = `<ul>\n  <% var unused1 = 'blah' -%>\n  <% var unused2 = 'bleh'  %>\n  <% var unused3 = 'bloh' -%>\n  <% var unused4 = 'bluh'  %>\n</ul>`
      var result = `<ul>\n  \n  \n</ul>`

      assert.equal(ejs.render(template), result);
    });

    it('consecutive tags work', function () {
      var template = `<% var a = 'foo' %><% var b = 'bar' %><%= a %>`;
      var result = `foo`
      assert.equal(ejs.render(template), result);
    });
  });

  describe('-%>', function () {
    it('not produce newlines', function () {
      var template = `<ul>
  <% users.forEach(function(user){ -%>
  <li><%= user %></li>
  <% }) -%>
</ul>`
      var result = `<ul>
  <li>a</li>
  <li>b</li>
  <li>c</li>
  </ul>`

      assert.equal(ejs.render(template, {users: ['a', 'b', 'c']}), result);
    });

    it('works with unix style', function () {
      var content = '<ul><% -%>\n'
      + '<% users.forEach(function(user){ -%>\n'
      + '<li><%= user -%></li>\n'
      + '<% }) -%>\n'
      + '</ul><% -%>\n';

      var expectedResult = '<ul><li>a</li>\n<li>b</li>\n<li>c</li>\n</ul>';
      assert.equal(ejs.render(content, {users: ['a', 'b', 'c']}), expectedResult);
    });

    it('works with windows style', function () {
      var content = '<ul><% -%>\r\n'
      + '<% users.forEach(function(user){ -%>\r\n'
      + '<li><%= user -%></li>\r\n'
      + '<% }) -%>\r\n'
      + '</ul><% -%>\r\n';

      var expectedResult = '<ul><li>a</li>\r\n<li>b</li>\r\n<li>c</li>\r\n</ul>';
      assert.equal(ejs.render(content, {users: ['a', 'b', 'c']}), expectedResult);
    });
  });

  describe('<%%', function () {
    it('produce literals', function () {
      assert.equal(ejs.render('<%%- "foo" %%>'),
        '<%- "foo" %>');
    });
    it('work without an end tag', function () {
      assert.equal(ejs.render('<%%'), '<%');

      assert.equal(ejs.render('<pre>\n <   .</pre>', {}, {openTag: '< ', openTagModifiers: {literal: ' '}}), '<pre>\n <  .</pre>')
    });
  });

  describe('%%>', function () {
    it('produce literal', function () {
      assert.equal(ejs.render('%%>'), '%>');

      assert.equal(ejs.render('  >', {}, {closeTag: ' >', closeTagModifiers: {literal: ' '}}), ' >');
    });
  });

  describe('comments', function () {
    it('fully render with comments removed', function () {
      var template = `<li><a href="foo"><% // double-slash comment %>foo</li>
<li><a href="bar"><% /* C-style comment */ %>bar</li>
<li><a href="baz"><% // double-slash comment with newline
    %>baz</li>
<li><a href="qux"><% var x = 'qux'; // double-slash comment @ end of line %><%= x %></li>
<li><a href="fee"><%# ERB style comment %>fee</li>
<li><a href="bah"><%= 'not a ' + '//' + ' comment' %></a></li>`

      var html = `<li><a href="foo">foo</li>
<li><a href="bar">bar</li>
<li><a href="baz">baz</li>
<li><a href="qux">qux</li>
<li><a href="fee">fee</li>
<li><a href="bah">not a // comment</a></li>`

      assert.equal(ejs.render(template), html);
    });
  });
  
});