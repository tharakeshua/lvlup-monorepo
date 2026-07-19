# Switch

Toggle control rendered as a `<label>` wrapping a checkbox and a styled track.
Forwards native checkbox props (`checked`, `onChange`, `disabled`).

```jsx
<Switch
  checked={notifications}
  onChange={(e) => setNotifications(e.target.checked)}
/>
```
