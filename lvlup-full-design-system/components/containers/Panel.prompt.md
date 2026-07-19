# Panel

A bordered surface with an optional header. The header only renders when `title`
or `actions` is provided; `actions` sit to the right of the title.

```jsx
<Panel
  title="Submissions"
  actions={
    <Button size="sm" variant="ghost">
      Export
    </Button>
  }
>
  <DataTable columns={cols} rows={rows} />
</Panel>
```
