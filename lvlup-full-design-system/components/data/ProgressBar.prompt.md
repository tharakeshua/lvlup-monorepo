# ProgressBar

Horizontal progress meter. Pass `value` (0–100) and an optional `variant`
(`spark`, `success`) to tint the fill. Exposes `role="progressbar"` with
`aria-valuenow`.

```jsx
<ProgressBar value={64} />
<ProgressBar value={88} variant="success" />
<ProgressBar value={40} variant="spark" />
```
