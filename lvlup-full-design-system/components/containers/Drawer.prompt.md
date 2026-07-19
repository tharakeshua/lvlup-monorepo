# Drawer

A slide-over sheet anchored to an `absolute`/`relative` container. The scrim and
the built-in close `IconButton` both call `onClose`. Use `side="left"` to slide
in from the left.

```jsx
<Drawer open={open} onClose={() => setOpen(false)} title="Filters">
  <Field label="Status">
    <Select options={statuses} />
  </Field>
</Drawer>
```
