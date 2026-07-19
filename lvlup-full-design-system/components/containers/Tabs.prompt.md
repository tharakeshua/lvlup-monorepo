# Tabs

Stateful tab group. The selected panel is tracked internally via
`React.useState`, seeded by `defaultIndex`. Pass `pill` for the pill variant.

```jsx
<Tabs
  defaultIndex={0}
  items={[
    { label: "Overview", content: <Overview /> },
    { label: "Submissions", content: <SubmissionsList /> },
    { label: "Settings", content: <Settings /> },
  ]}
/>
```
