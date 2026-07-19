# Button

Primary action control. `variant` selects the look (primary, secondary, ghost,
danger, spark), `size` is `sm`/`lg`, and `block` makes it full-width. Use
`loading`/`disabled` for states and `leadingIcon`/`trailingIcon` to slot an
`<Icon>`.

```jsx
<Button
  variant="spark"
  size="lg"
  leadingIcon={<Icon name="sparkles" size={16} />}
>
  Start practice
</Button>
```
