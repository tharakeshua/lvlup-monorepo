# DataTable

Tabular data with sortable headers, numeric alignment, per-row selection, and
custom cell renderers. Pass `columns` (each
`{key, label, numeric, sortable, render}`) and `rows`; mark a row `selected` to
highlight it.

```jsx
<DataTable
  columns={[
    { key: "name", label: "Student", sortable: true },
    { key: "xp", label: "XP", numeric: true, sortable: true },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge variant="success">{r.status}</Badge>,
    },
  ]}
  rows={[
    { name: "Asha", xp: 1240, status: "Active", selected: true },
    { name: "Devang", xp: 980, status: "Active" },
  ]}
/>
```
