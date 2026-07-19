# Card

A neutral surface container. Pass `interactive` to add the hover/focus
affordance for clickable cards. Any extra props (e.g. `onClick`, `role`) pass
through to the root `<div>`.

```jsx
<Card interactive onClick={() => open(space)}>
  <h3>Dynamic Programming</h3>
  <p>12 story points · 64% mastered</p>
</Card>
```
