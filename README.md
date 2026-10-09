# dev-piece

Small browser tools: JSON, a SQL formatter, base64, a line diff, and a Markdown preview.

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

## Diff

Paste text, or choose a file, on each side. Click **Compare**. Added lines, removed lines, and unchanged lines are marked in the result.

## Markdown

The preview updates as you type, including tables, task lists, and strikethrough. Scrolling either pane moves the other. Pasting stays at the top of the editor; typing further down follows the cursor. HTML in the source is sanitized before it is shown. Links open in a new tab.

## Theme

**Dark** / **Light** in the header switches the theme. The choice is remembered, and a first visit follows the system preference.

## GitHub Pages

After a push to `master`, the site updates from that branch at `/` (root). Turn that on once under **Settings → Pages → Deploy from a branch**.
