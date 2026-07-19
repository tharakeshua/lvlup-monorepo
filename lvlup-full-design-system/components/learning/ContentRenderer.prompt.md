# ContentRenderer

A prose surface for rendered markdown, code, and KaTeX math. Pass pre-rendered
markup via `html` (uses `dangerouslySetInnerHTML`), or pass JSX `children`. Set
`math` to enable the math-aware styling variant.

```jsx
<ContentRenderer
  math
  html="<p>The runtime is <code>O(n log n)</code> via the master theorem.</p>"
/>
```
