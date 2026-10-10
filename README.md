# dev-piece

Small browser tools: JSON, a SQL formatter, base64, JWT inspection, a line diff, and Markdown and HTML previews.

Open `index.html` in a browser, or use [https://shrish789.github.io/dev-piece/](https://shrish789.github.io/dev-piece/). There is no compile step. GitHub Pages hosts the files. The tools run in the browser.

The tab is the hash on the URL, for example `https://shrish789.github.io/dev-piece/#diff`. The choice is remembered.

## JSON

1. Paste JSON into **Unparsed**.
2. Click **Parse**.
3. Browse the result in **Parsed**.

Invalid JSON leaves the parsed pane empty and shows the parser error in the toolbar.

Strings that themselves contain JSON objects or arrays are parsed again, so nested JSON stored as text shows up as structure.

- **JSON** and **Tree** switch the layout. The choice is remembered.
- **Search parsed** highlights keys and values. **Prev** and **Next** move between matches. Enter goes to the next match; Shift+Enter goes to the previous one. With the parsed pane focused, Cmd+F (Ctrl+F) focuses the search box.
- **Collapse** and **Expand** close or open every node. The first level starts open.

## SQL

Paste SQL and click **Format**. Keywords are uppercased and the statement is broken onto lines. The dialect (Standard, PostgreSQL, MySQL, SQLite, BigQuery, T-SQL, or Snowflake) is remembered. Changing it reformats the current result. A formatter error leaves the result unchanged.

## Base64

**Encode** turns text into base64. **Decode** turns base64 into text. The selected direction stays highlighted, and the two panes are labeled for that direction. Switching direction puts the current result on the left and converts it again. The conversion uses UTF-8, so non-ASCII text round-trips. Invalid base64 shows the error and leaves the output unchanged. The direction is remembered.

## JWT

Paste a three-part compact JWT, with or without the common `Bearer ` prefix, to inspect its header, payload, signature segment, and readable `exp`, `nbf`, and `iat` timestamps. Decoding happens as you type and Cmd+Enter on macOS or Ctrl+Enter elsewhere runs it immediately. Tokens and secrets stay in the page and are never saved.

Decoding shows the token's contents but does not establish that they came from a trusted issuer. For tokens using HS256, HS384, or HS512, enter the shared HMAC secret and click **Verify** to check the signature. The verifier treats the entered value as a UTF-8 secret. Five-part encrypted JWE tokens are identified but cannot be decrypted by this tool.

## Diff

Paste text, or choose a file, on each side and click **Compare**. The comparison preview appears above the editors and aligns the original and changed files side by side with line numbers, red/green line backgrounds, and stronger character-level highlights inside edited lines. Both editors scroll together. After the first comparison, the result updates as you type. **Swap** reverses the two sides and **Clear** starts over. Missing final newlines are called out.

Choose **Character details** for exact inserted and deleted character runs with left/right `line:column` ranges. Positions start at 1; the end position is exclusive. Columns count Unicode code points, so an emoji counts as one character. Spaces (`·`), tabs (`⇥`), LF (`↵`), and CR (`␍`) are made visible. Comparisons include whitespace and case. Browser textareas normalize input line endings, so this is a text comparison rather than a byte-for-byte file comparison.

## Markdown

The preview updates as you type, including tables, task lists, strikethrough, and syntax-highlighted fenced code blocks. Add a language after the opening three backticks, such as `js`, for accurate highlighting and a visible language header; unlabelled blocks use automatic language detection. Tables use bordered cells and alternating row backgrounds in both themes. Scrolling either pane moves the other. Pasting stays at the top of the editor; typing further down follows the cursor. HTML in the source is sanitized before it is shown. Links open in a new tab.

The draft, selection, and scroll position are automatically saved in this browser and restored after reload. Changes are saved after a short pause and when leaving the page. **Clear draft** asks before clearing the editor and saved draft. The toolbar reports storage errors; editing and preview still work if storage is blocked or full. Drafts remain local to this browser and site; they are not synced across devices.

## HTML

Write or paste HTML and CSS into **HTML source**. **Live preview** updates the rendered iframe as you type; turn it off to update only with **Render**. The draft and live-preview preference are saved in this browser. **Clear** asks before removing a saved draft.

The preview uses an isolated iframe and a restrictive content policy. Scripts, network requests from JavaScript, embedded frames, plugins, form submissions, and access to the utilities page are blocked. Inline CSS works, and external HTTP(S) styles, images, fonts, and media can load. Cmd+Enter on macOS or Ctrl+Enter elsewhere renders immediately.

## Theme

**Dark** / **Light** in the header switches the theme. The choice is remembered, and a first visit follows the system preference.

Controls have visible keyboard focus and adapt to narrow screens. In JSON, SQL, and Diff, press Cmd+Enter on macOS or Ctrl+Enter elsewhere to run the primary action.

## GitHub Pages

After a push to `master`, the site updates from that branch at `/` (root). Turn that on once under **Settings → Pages → Deploy from a branch**.

## Feature checks and references

Run `node tests/features-check.js`, `node tests/jwt-check.js`, and `node base64-check.js`. The feature checks use a lightweight DOM harness to exercise the browser tools and draft persistence; they do not replace visual browser testing.

Implementation references: [JWT](https://www.rfc-editor.org/rfc/rfc7519), [JWS compact serialization](https://www.rfc-editor.org/rfc/rfc7515), [jsdiff line and character APIs](https://github.com/kpdecker/jsdiff), [Diffchecker's side-by-side text comparison](https://www.diffchecker.com/text-compare/), and [MDN Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API).
