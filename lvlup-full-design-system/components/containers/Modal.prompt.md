# Modal

Centered dialog. Returns `null` when `open` is false. Clicking the scrim fires
`onClose`; clicks inside the dialog are stopped so they don't dismiss it. Pass
`footer` for action buttons.

```jsx
<Modal
  open={open}
  onClose={() => setOpen(false)}
  title="Delete space?"
  footer={
    <>
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button variant="danger" onClick={remove}>
        Delete
      </Button>
    </>
  }
>
  This permanently removes the space and its content.
</Modal>
```
