# LoadingOverlay

A full-cover scrim with a centered spinner. Render it inside a
`position: relative` container to block and indicate that the underlying content
is loading.

```jsx
<div style={{ position: "relative", minHeight: 200 }}>
  <DataTable columns={columns} rows={rows} />
  {isFetching && <LoadingOverlay />}
</div>
```
