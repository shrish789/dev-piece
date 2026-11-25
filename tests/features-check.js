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
  const clipboard = {
    text: "",
    writeText(value) {
      this.text = value;
      return Promise.resolve();
    }
  };
  const context = {
    document, window, Diff, navigator: { clipboard },
    TextEncoder, TextDecoder, Uint8Array, atob, btoa, crypto: globalThis.crypto,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    marked: { parse: text => text }, DOMPurify: { sanitize: text => text },
    hljs: { highlighted: [], highlightElement(element) { this.highlighted.push(element); } },
    ResizeObserver: class { observe() {} },
    requestAnimationFrame: fn => frames.push(fn), setTimeout: () => 1, clearTimeout() {}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/copy.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  return { get, context, window, frames, storage, clipboard };
}

const json = harness('js/json.js', new Map([['view', 'json']]));
json.get('input').value = '{"a\\"b":"line\\nnext"}';
json.get('parse').fire('click');
const jsonRoot = json.get('output').children[0];
const jsonLeaf = jsonRoot.children[1].children[0];
assert.equal(jsonLeaf.children[0].textContent, '"a\\"b"');
assert.equal(jsonLeaf.children[2].textContent, '"line\\nnext"');
assert.equal(jsonRoot.open, true);

function openFlags(storage) {
  const session = harness('js/json.js', storage);
  session.get('input').value = '{"outer":{"inner":1}}';
  session.get('parse').fire('click');
  const root = session.get('output').children[0];
  return [session, root.open, root.children[1].children[0].open];
}
const [firstLevel, rootOpen, childOpen] = openFlags(new Map([['view', 'json']]));
assert.deepEqual([rootOpen, childOpen], [true, false]);
assert.equal(firstLevel.get('json-expand').value, 'level');
firstLevel.get('json-expand').value = 'expanded';
firstLevel.get('json-expand').fire('change');
const expandedRoot = firstLevel.get('output').children[0];
assert.equal(expandedRoot.open, true);
assert.equal(expandedRoot.children[1].children[0].open, true);
assert.equal(firstLevel.storage.get('json-expand'), 'expanded');
const [, collapsedRoot, collapsedChild] = openFlags(new Map([['view', 'json'], ['json-expand', 'collapsed']]));
assert.deepEqual([collapsedRoot, collapsedChild], [false, false]);
const [, ignoredRoot, ignoredChild] = openFlags(new Map([['view', 'json'], ['json-expand', 'nope']]));
assert.deepEqual([ignoredRoot, ignoredChild], [true, false]);
const treeExpanded = harness('js/json.js', new Map([['json-expand', 'expanded']]));
treeExpanded.get('input').value = '{"outer":{"inner":1}}';
treeExpanded.get('parse').fire('click');
const treeRoot = treeExpanded.get('output').children[0];
assert.equal(treeRoot.open, true);
assert.equal(treeRoot.children[1].children[0].open, true);

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
diff.get('diff-copy').fire('click');
assert.match(diff.clipboard.text, /--- original/);
assert.match(diff.clipboard.text, /-hello cat/);
assert.match(diff.clipboard.text, /\+hello cut/);
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
scrolling.get('markdown-input').value = '<p>kept</p>';
scrolling.get('markdown-input').fire('input');
scrolling.get('copy-markdown').fire('click');
assert.equal(scrolling.clipboard.text, '<p>kept</p>');
assert.equal(scrolling.get('copy-markdown').disabled, false);

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

const copiedJwt = harness('js/jwt.js');
copiedJwt.get('jwt-input').value = jwtExample;
copiedJwt.get('jwt-input').fire('input');
copiedJwt.get('copy-jwt-header').fire('click');
assert.match(copiedJwt.clipboard.text, /"alg": "HS256"/);
copiedJwt.get('copy-jwt-payload').fire('click');
assert.match(copiedJwt.clipboard.text, /"name": "John Doe"/);
copiedJwt.get('copy-jwt-signature').fire('click');
assert.equal(copiedJwt.clipboard.text, 'invalid');
assert.equal(copiedJwt.get('copy-jwt-header').disabled, false);
copiedJwt.get('jwt-clear').fire('click');
assert.equal(copiedJwt.get('copy-jwt-payload').disabled, true);

const sql = harness('js/sql.js');
sql.get('sql-output').value = 'SELECT 1';
sql.get('copy-sql').disabled = false;
sql.get('copy-sql').fire('click');
assert.equal(sql.clipboard.text, 'SELECT 1');

const base64 = harness('js/base64.js');
base64.get('base64-input').value = 'hi';
base64.get('base64-input').fire('input');
base64.get('copy-base64').fire('click');
assert.equal(base64.clipboard.text, 'aGk=');
assert.equal(base64.get('copy-base64').disabled, false);

const cron = harness('js/cron.js');
assert.equal(cron.get('cron-input').value, '* * * * *');
assert.equal(cron.get('cron-summary').textContent, 'Every minute');
assert.equal(cron.get('cron-minute').value, '*');
assert.equal(cron.get('cron-hint-minute').textContent, 'any minute');
assert.equal(cron.get('copy-cron').disabled, false);
assert(cron.get('cron-preset-minute').className.includes('active'));
assert.equal(cron.get('cron-next').children.length, 8);
assert.match(cron.get('cron-next-title').textContent, /^Next runs · UTC[+-]\d{2}:\d{2}$/);

const cronMonths = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function readCronRun(text) {
  const match = text.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (\d{2}) ([A-Za-z]{3}) (\d{4}), (\d{2}):(\d{2})$/);
  assert(match, text);
  return {
    weekday: match[1],
    day: Number(match[2]),
    date: new Date(Number(match[4]), cronMonths[match[3]], Number(match[2]), Number(match[5]), Number(match[6]))
  };
}
const everyMinute = cron.get('cron-next').children.map(item => readCronRun(item.textContent));
assert(everyMinute[0].date.getTime() > Date.now() - 1000);
assert(everyMinute[0].date.getTime() - Date.now() < 120000);
assert.equal(everyMinute[1].date.getTime() - everyMinute[0].date.getTime(), 60000);

function explainCron(expression) {
  cron.get('cron-input').value = expression;
  cron.get('cron-input').fire('input');
  return cron.get('cron-summary').textContent;
}
assert.equal(explainCron('*/15 * * * *'), 'Every 15 minutes');
assert.equal(explainCron('0 * * * *'), 'Every hour');
assert.equal(explainCron('0 */2 * * *'), 'Every 2 hours');
assert.equal(explainCron('30 4 * * *'), 'At 04:30, every day');
assert.equal(explainCron('0 9 * * 1-5'), 'At 09:00, only on Monday through Friday');
assert.equal(explainCron('0 0 1 * *'), 'At 00:00, on day 1 of the month');
assert.equal(explainCron('0 0 * * 0'), 'At 00:00, only on Sunday');
assert.equal(explainCron('0 0 1 * 1'), 'At 00:00, on day 1 of the month, and on Monday');
assert.equal(explainCron('0 0 1 1 *'), 'At 00:00, on day 1 of the month, only in January');
assert.equal(explainCron('0 9-17 * * *'), 'Every hour from 09:00 through 17:00');
assert.equal(explainCron('15,45 * * * *'), 'At minutes 15 and 45 of every hour');
assert.equal(explainCron('0 0 * JAN MON'), 'At 00:00, only in January, only on Monday');
assert.equal(explainCron('0 0 1 JUL *'), 'At 00:00, on day 1 of the month, only in July');
assert.equal(cron.get('cron-hint-month').textContent, 'July');
assert.equal(explainCron('@hourly'), 'Every hour');
assert.equal(cron.get('cron-status').textContent, '@hourly is 0 * * * *');
assert.equal(cron.get('cron-minute').value, '0');
assert(cron.get('cron-preset-hourly').className.includes('active'));
assert.equal(explainCron('@reboot'), 'Runs when cron restarts');
assert.equal(cron.get('cron-next-empty').textContent, 'No timetable');
assert.equal(explainCron('0 0 * * 7'), 'At 00:00, only on Sunday');
for (const item of cron.get('cron-next').children) assert.equal(readCronRun(item.textContent).weekday, 'Sun');

explainCron('0 0 1 * 1');
const eitherDay = cron.get('cron-next').children.map(item => readCronRun(item.textContent));
assert(eitherDay.every(run => run.weekday === 'Mon' || run.day === 1));
assert(eitherDay.some(run => run.weekday === 'Mon' && run.day !== 1));
assert(eitherDay.some(run => run.day === 1));
for (const run of eitherDay) assert.equal(run.date.getHours(), 0);
assert.equal(cron.get('cron-weekday').value, '1');

explainCron('0 9 * * 1-5');
for (const item of cron.get('cron-next').children) {
  const run = readCronRun(item.textContent);
  assert(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(run.weekday));
  assert.equal(run.date.getHours(), 9);
  assert.equal(run.date.getMinutes(), 0);
}

explainCron('0 0 31 2 *');
assert.equal(cron.get('cron-next').children.length, 0);
assert.match(cron.get('cron-next-empty').textContent, /No runs in the next 8 years/);

explainCron('60 * * * *');
assert.equal(cron.get('cron-summary').textContent, "Can't read that expression");
assert.match(cron.get('cron-status').textContent, /Minute: must be from 0 to 59/);
assert.equal(cron.get('copy-cron').disabled, true);
assert.equal(cron.get('cron-next').children.length, 0);
explainCron('* * * * * *');
assert.match(cron.get('cron-status').textContent, /Use 5 fields/);
explainCron('0 0 1 * L');
assert.match(cron.get('cron-status').textContent, /outside standard crontab/);

cron.get('cron-minute').value = '*/5';
cron.get('cron-hour').value = '*';
cron.get('cron-day').value = '*';
cron.get('cron-month').value = '*';
cron.get('cron-weekday').value = 'MON-FRI';
cron.get('cron-minute').fire('input');
assert.equal(cron.get('cron-input').value, '*/5 * * * MON-FRI');
assert.equal(cron.get('cron-summary').textContent, 'Every 5 minutes, only on Monday through Friday');
assert.equal(cron.get('cron-hint-weekday').textContent, 'Monday through Friday');

cron.get('cron-preset-weekly').fire('click');
assert.equal(cron.get('cron-input').value, '0 0 * * 0');
assert.equal(cron.get('cron-summary').textContent, 'At 00:00, only on Sunday');
assert(cron.get('cron-preset-weekly').className.includes('active'));
assert.equal(cron.storage.get('cron-expression'), '0 0 * * 0');
cron.get('copy-cron').fire('click');
assert.equal(cron.clipboard.text, '0 0 * * 0');
const restoredCron = harness('js/cron.js', cron.storage);
assert.equal(restoredCron.get('cron-input').value, '0 0 * * 0');
assert.equal(restoredCron.get('cron-summary').textContent, 'At 00:00, only on Sunday');

console.log('Feature checks passed: JSON rendering, HTML preview isolation, side-by-side and exact diff views, live updates, Unicode, line endings, draft restore, scroll sync, syntax highlighting, clear, storage failures, and cron explanations.');
