# Toast

Transient notification with a severity icon, title, and optional body. Pass
`variant` to pick the severity (`success` | `error` | `warning` | `info`,
default `info`); the matching lucide icon and `.toast--{variant}` color are
applied automatically.

```jsx
<Toast
  variant="success"
  title="Submission graded"
  body="Your essay scored 8.5/10 — review the rubric for details."
/>
```
