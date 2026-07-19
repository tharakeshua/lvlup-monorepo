# Input

Single-line text field. Forwards all native `<input>` props (`type`, `value`,
`placeholder`, `onChange`, `disabled`). Set `error` to apply the error border.

```jsx
<Input
  type="email"
  placeholder="you@school.edu"
  error
  onChange={(e) => set(e.target.value)}
/>
```
