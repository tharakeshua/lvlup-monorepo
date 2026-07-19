# CommandPalette

⌘K quick switcher. Renders a search `input` over a list of `items`, each with an
optional lucide `icon`, a `label`, and an optional `kbd` shortcut hint.
Highlight a row with the `selected` index (applies `aria-selected`).

```jsx
<CommandPalette
  placeholder="Search or jump to…"
  selected={0}
  items={[
    { icon: "search", label: "Search content", kbd: "/" },
    { icon: "plus", label: "New space", kbd: "N" },
    { icon: "settings", label: "Settings", kbd: "," },
  ]}
/>
```
