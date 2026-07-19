# Breadcrumb

Renders a hierarchical path from an `items` array. Every item except the last is
a link; the final item is shown as the current (non-link) location, with `/`
separators between.

```jsx
<Breadcrumb
  items={[
    { label: "Spaces", href: "/spaces" },
    { label: "Data Structures", href: "/spaces/dsa" },
    { label: "Arrays" },
  ]}
/>
```
