# Accordion

Single-open accordion. Tracks the open section internally with `React.useState`;
clicking the open section collapses it (-1). Each trigger shows a `chevron-down`
icon that rotates via the `data-open` state.

```jsx
<Accordion
  defaultOpen={0}
  items={[
    { title: "What is a story point?", content: <p>A unit of mastery…</p> },
    { title: "How is XP earned?", content: <p>By completing items…</p> },
  ]}
/>
```
