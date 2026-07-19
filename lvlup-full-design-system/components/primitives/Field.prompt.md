# Field

Form-field wrapper that pairs a `label` with a control (passed as `children`)
and a `hint` or `error` message. When `error` is set it renders an alert-circle
icon and hides the hint. Use `required` for the asterisk and `htmlFor` to link
the label to the input id.

```jsx
<Field label="Email" required htmlFor="email" error="Enter a valid address">
  <Input id="email" type="email" error />
</Field>
```
