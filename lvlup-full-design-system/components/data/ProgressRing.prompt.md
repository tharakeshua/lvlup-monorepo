# ProgressRing

Circular percentage indicator driven by the `--ring-pct` CSS var. Pass `value`
(0–100), optional `size` (px, default 56), and an optional `label` override
(defaults to `value%`).

```jsx
<ProgressRing value={72} />
<ProgressRing value={100} size={72} label="Done" />
```
