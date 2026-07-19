# Alert

Inline / banner message that stays in the layout (unlike a transient Toast).
Pass `variant` for severity (`success` | `error` | `warning` | `info`, default
`info`), an optional `title`, and the message as `children`.

```jsx
<Alert variant="warning" title="Heads up">
  This exam closes in 10 minutes. Unsaved answers will be auto-submitted.
</Alert>
```
