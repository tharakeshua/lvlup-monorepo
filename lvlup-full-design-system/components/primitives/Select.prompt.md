# Select

Native dropdown. Pass `options={[{value,label}]}` for the common case, or supply
`<option>` children directly. Forwards native props (`value`, `onChange`,
`disabled`).

```jsx
<Select
  options={[
    { value: "easy", label: "Easy" },
    { value: "hard", label: "Hard" },
  ]}
  onChange={(e) => set(e.target.value)}
/>
```
