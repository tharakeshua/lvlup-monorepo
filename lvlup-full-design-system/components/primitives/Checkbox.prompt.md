# Checkbox

Styled native checkbox. Forwards native props (`checked`, `onChange`,
`disabled`). Pair with a `<label>` for accessibility.

```jsx
<label className="ds-row">
  <Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />I
  accept the honor code
</label>
```
