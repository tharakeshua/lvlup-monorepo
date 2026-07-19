# Section

A semantic `<section>` with an `<h3>` header row. Use it to group related
content within a page; pass `actions` for header-level controls.

```jsx
<Section
  title="Recent activity"
  actions={
    <Button variant="ghost" size="sm">
      View all
    </Button>
  }
>
  <Timeline items={events} />
</Section>
```
