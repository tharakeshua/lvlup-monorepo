# Radio

Styled native radio. Group options by sharing a `name`. Forwards native props
(`checked`, `onChange`, `disabled`).

```jsx
<label className="ds-row">
  <Radio
    name="difficulty"
    value="hard"
    checked={level === "hard"}
    onChange={() => setLevel("hard")}
  />
  Hard
</label>
```
