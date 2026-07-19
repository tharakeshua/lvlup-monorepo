# Badge

Compact status label. Pick a `variant` (`brand`, `success`, `warning`, `error`,
`info`, `spark`), add a leading `icon` node, or use `dot` for a status dot.

```jsx
<Badge variant="success">Active</Badge>
<Badge variant="warning" dot>Pending</Badge>
<Badge variant="spark" icon={<Icon name="sparkles" size={12} />}>New</Badge>
```
