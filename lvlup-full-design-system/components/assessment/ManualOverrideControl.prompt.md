# ManualOverrideControl

A teacher control that flags a score was set by hand instead of by the
auto-grader. Pass `children` (e.g. an `Input` or `Button`) to supply the
override action.

```jsx
<ManualOverrideControl label="Manual override">
  <Input type="number" defaultValue={8} />
</ManualOverrideControl>
```
