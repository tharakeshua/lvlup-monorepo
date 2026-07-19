# Slider

Range control over a native `<input type="range">`. Forwards native props
(`min`, `max`, `step`, `value`, `onChange`).

```jsx
<Slider
  min={0}
  max={100}
  value={confidence}
  onChange={(e) => setConfidence(+e.target.value)}
/>
```
