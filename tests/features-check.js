const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Diff = require('../vendor/diff.min.js');

function harness(file, storage = new Map()) {
  const elements = new Map();
  class Element {
    constructor() {
      this.value = ''; this.children = []; this.handlers = {}; this.textContent = '';
      this.className = ''; this.selectionStart = 0; this.selectionEnd = 0;
      this.dataset = {}; this.attributes = {};
      this.scrollHeight = 1000; this.clientHeight = 100; this.scrollTop = 0;
      this.classList = {
        add: name => { if (!this.classList.contains(name)) this.className += (this.className ? ' ' : '') + name; },
        contains: name => this.className.split(/\s+/).includes(name),
        toggle: (name, force) => {
          const enabled = force ?? !this.classList.contains(name);
          const names = this.className.split(/\s+/).filter(Boolean).filter(item => item !== name);
          if (enabled) names.push(name);
          this.className = names.join(' ');
          return enabled;
        }
      };
    }
    addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); }
    fire(name) { for (const fn of this.handlers[name] || []) fn({}); }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes.flatMap(n => n.fragment ? n.children : [n]); }
    querySelectorAll() { return []; }
    setAttribute(name, value) { this.attributes[name] = value; }
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
    focus() {}
  }
  const get = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const window = new Element(); window.confirm = () => true;
  const document = new Element();
  Object.assign(document, {
    getElementById: get,
    createElement: () => new Element(),
    createDocumentFragment: () => Object.assign(new Element(), { fragment: true })
  });
  const frames = [];
  const context = {
    document, window, Diff,
    TextEncoder, TextDecoder, Uint8Array, atob, btoa, crypto: globalThis.crypto,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    marked: { parse: text => text }, DOMPurify: { sanitize: text => text },
    hljs: { highlighted: [], highlightElement(element) { this.highlighted.push(element); } },
    ResizeObserver: class { observe() {} },
    requestAnimationFrame: fn => frames.push(fn), setTimeout: () => 1, clearTimeout() {}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  return { get, context, window, frames, storage };
}

const json = harness('js/json.js', new Map([['view', 'json']]));
json.get('input').value = '{"a\\"b":"line\\nnext"}';
json.get('parse').fire('click');
const jsonRoot = json.get('output').children[0];
const jsonLeaf = jsonRoot.children[1].children[0];
assert.equal(jsonLeaf.children[0].textContent, '"a\\"b"');
assert.equal(jsonLeaf.children[2].textContent, '"line\\nnext"');

const jwt = harness('js/jwt.js');
const jwtExample = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid';
jwt.get('jwt-input').value = `Bearer ${jwtExample}`;
jwt.get('jwt-input').fire('input');
assert(jwt.get('jwt-header').textContent.includes('"alg": "HS256"'));
assert(jwt.get('jwt-payload').textContent.includes('"name": "John Doe"'));
assert.equal(jwt.get('jwt-secret').disabled, false);
assert(jwt.get('jwt-status').className.includes('warning'));
assert.equal(jwt.get('jwt-signature').textContent, 'invalid');
jwt.get('jwt-input').value = 'one.two.three.four.five';
jwt.get('jwt-input').fire('input');
assert(jwt.get('jwt-status').textContent.includes('encrypted JWE'));
jwt.get('jwt-clear').fire('click');
assert.equal(jwt.get('decode-jwt').disabled, true);

const diff = harness('js/diff.js');
assert.equal(diff.get('compare').disabled, true);
assert.equal(diff.get('diff-swap').disabled, true);
assert.equal(diff.get('diff-clear').disabled, true);
function compare(left, right, mode) {
  diff.get('diff-left').value = left; diff.get('diff-right').value = right;
  diff.get('diff-mode').value = mode;
  diff.get('diff-left').fire('input');
  diff.get('compare').fire('click');
  return diff.get('diff-result').children.slice(1);
}
function nodeText(node) {
  return node.children.length
    ? node.children.map(child => typeof child === 'string' ? child : nodeText(child)).join('')
    : node.textContent;
}
function gutter(row, side) { return row.children[side].children[0].textContent; }
function content(row, side) { return nodeText(row.children[side].children[1]); }
let rows = compare('hello cat\n', 'hello cut\n', 'characters');
assert(rows.some(row => gutter(row, 0) === '1:8–1:9' && content(row, 0) === 'a'));
assert(rows.some(row => gutter(row, 1) === '1:8–1:9' && content(row, 1) === 'u'));
assert.equal(diff.get('diff-status').textContent, '1 characters added, 1 removed');
rows = compare('😀x', '😀y', 'characters');
assert(rows.some(row => gutter(row, 0) === '1:2–1:3' && content(row, 0) === 'x'));
rows = compare('a\n', 'a', 'lines');
assert(rows.some(row => content(row, 1).includes('No newline at end of file')));
rows = compare('a\r\nb\n', 'a\nb\n', 'characters');
assert(rows.some(row => content(row, 0) === '␍'));
assert.equal(compare('', '', 'lines').length, 0);
assert.equal(diff.get('diff-status').textContent, '');
rows = compare('old\nkeep\n', 'new\nkeep\n', 'lines');
assert(rows.some(row => gutter(row, 0) === '2' && gutter(row, 1) === '2' && content(row, 0) === 'keep'));
rows = compare('hello cat\n', 'hello cut\n', 'lines');
assert(rows[0].children[0].className.includes('removed'));
assert(rows[0].children[1].className.includes('added'));
assert(rows[0].children[0].children[1].children.some(span => span.className.includes('diff-inline removed') && span.textContent === 'a'));
diff.get('diff-left').fire('input');
assert(diff.get('diff-result').children.length > 0, 'comparison should update live after the first compare');
diff.get('diff-swap').fire('click');
assert.equal(diff.get('diff-left').value, 'hello cut\n');
diff.get('diff-left').scrollTop = 450;
diff.get('diff-left').fire('scroll');
assert.equal(diff.get('diff-right').scrollTop, 450);
diff.get('diff-clear').fire('click');
assert.equal(diff.get('diff-result').children.length, 0);
assert.equal(diff.get('compare').disabled, true);
assert.equal(diff.get('diff-swap').disabled, true);
assert.equal(diff.get('diff-clear').disabled, true);

const first = harness('js/markdown.js');
first.get('markdown-input').value = '# Saved draft\n😀';
first.get('markdown-input').setSelectionRange(2, 7);
first.get('markdown-input').scrollTop = 450;
first.window.fire('pagehide');
const second = harness('js/markdown.js', first.storage);
second.frames.forEach(fn => fn());
assert.equal(second.get('markdown-input').value, '# Saved draft\n😀');
assert.equal(second.get('markdown-input').selectionStart, 2);
assert.equal(second.get('markdown-input').selectionEnd, 7);
assert.equal(second.get('markdown-input').scrollTop, 450);
assert.equal(second.get('markdown-preview').scrollTop, 450);
second.window.confirm = () => false;
second.get('markdown-clear').fire('click');
assert.equal(second.get('markdown-input').value, '# Saved draft\n😀');
second.window.confirm = () => true;
second.get('markdown-clear').fire('click');
assert.equal(JSON.parse(first.storage.get('markdown-draft-v1')).text, '');
const unavailable = harness('js/markdown.js', { get() { throw Error('blocked'); }, set() { throw Error('full'); } });
unavailable.get('markdown-input').value = 'keep working';
unavailable.window.fire('pagehide');
assert.equal(unavailable.get('markdown-input').value, 'keep working');
assert.equal(unavailable.get('markdown-status').className, 'status error');
const corrupt = harness('js/markdown.js', new Map([['markdown-draft-v1', '{broken']]));
assert.equal(corrupt.get('markdown-input').value, '');
const scrolling = harness('js/markdown.js');
scrolling.frames.splice(0).forEach(fn => fn());
scrolling.get('markdown-input').scrollTop = 450;
scrolling.get('markdown-input').fire('scroll');
assert.equal(scrolling.get('markdown-preview').scrollTop, 450);
scrolling.get('markdown-preview').scrollTop = 449;
scrolling.get('markdown-preview').fire('scroll');
assert.equal(scrolling.get('markdown-input').scrollTop, 450, 'preview must not feed a rounded position back');
const codePanel = new (scrolling.get('markdown-preview').constructor)();
const code = { className: 'language-javascript', parentElement: codePanel };
scrolling.get('markdown-preview').querySelectorAll = selector => selector === 'pre code' ? [code] : [];
scrolling.get('markdown-input').fire('input');
assert.equal(scrolling.context.hljs.highlighted.at(-1), code);
assert.equal(codePanel.dataset.language, 'javascript');
assert.equal(codePanel.attributes['aria-label'], 'javascript code block');

const htmlStorage = new Map([['html-draft-v1', JSON.stringify({ text: '<h1>Saved</h1>', live: true })]]);
const html = harness('js/html.js', htmlStorage);
assert.equal(html.get('html-input').value, '<h1>Saved</h1>');
assert.equal(html.get('html-live').checked, true);
assert.equal(html.get('render-html').disabled, false);
assert.equal(html.get('html-clear').disabled, false);
assert(html.get('html-preview').srcdoc.includes("script-src 'none'"));
assert(html.get('html-preview').srcdoc.includes('<h1>Saved</h1>'));
html.get('html-input').value = '<!doctype html><html><head><style>h1{color:red}</style></head><body><h1>Preview</h1><script>alert(1)</script></body></html>';
html.get('render-html').fire('click');
assert(html.get('html-preview').srcdoc.indexOf('Content-Security-Policy') < html.get('html-preview').srcdoc.indexOf('<style>'));
assert(html.get('html-preview').srcdoc.includes('<h1>Preview</h1>'));
html.window.confirm = () => true;
html.get('html-clear').fire('click');
assert.equal(html.get('html-input').value, '');
assert.equal(html.get('render-html').disabled, true);
assert.equal(html.get('html-clear').disabled, true);
assert.equal(JSON.parse(htmlStorage.get('html-draft-v1')).text, '');

console.log('Feature checks passed: JSON rendering, HTML preview isolation, side-by-side and exact diff views, live updates, Unicode, line endings, draft restore, scroll sync, syntax highlighting, clear, and storage failures.');
