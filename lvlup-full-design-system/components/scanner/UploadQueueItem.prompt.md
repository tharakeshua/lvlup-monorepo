# UploadQueueItem

A single row in an offline upload queue. The `status` drives the leading icon
and body: `queued`/`done`/`failed` show a `meta` caption, while `uploading`
renders a `ProgressBar` fed by `progress`.

```jsx
<UploadQueueItem
  status="uploading"
  name="midterm-page-02.jpg"
  progress={45}
  meta="3.1 MB · 45%"
/>
```
