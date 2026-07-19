# Timeline

Vertical activity feed. Pass `items` as `{time, label, variant}`; `variant`
(e.g. `success`, `muted`) colors the dot.

```jsx
<Timeline
  items={[
    { time: "09:02", label: "Submission graded", variant: "success" },
    { time: "08:40", label: "Exam started" },
    { time: "Yesterday", label: "Space published", variant: "muted" },
  ]}
/>
```
