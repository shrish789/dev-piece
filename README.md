# JSON parser

A single-page viewer for JSON. Paste text, parse it, then browse the result as a collapsible tree or as formatted JSON.

Open `index.html` in a browser. There is no build step and no dependencies.

## Use

1. Paste JSON into **Unparsed**.
2. Click **Parse**.
3. Browse the result in **Parsed**.

Invalid JSON leaves the parsed pane empty and shows the parser error in the header.

Strings that themselves contain JSON objects or arrays are parsed again, so nested JSON stored as text shows up as structure.

## Parsed pane

- **JSON** and **Tree** switch the layout. The choice is remembered.
- **Search parsed** highlights keys and values. **Prev** and **Next** move between matches. Enter goes to the next match; Shift+Enter goes to the previous one. With the parsed pane focused, Cmd+F (Ctrl+F) focuses the search box.
- **Collapse** and **Expand** close or open every node. The first level starts open.

## Theme

**Dark** / **Light** in the header switches the theme. The choice is remembered, and a first visit follows the system preference.
