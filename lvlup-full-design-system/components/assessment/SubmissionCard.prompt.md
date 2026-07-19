# SubmissionCard

A student submission row: composes `Avatar` from the student's initials plus
name and meta. Pass `children` for trailing status, like a `GradePill` or
`ConfidenceBadge`.

```jsx
<SubmissionCard
  initials="JS"
  name="Jordan Smith"
  meta="Submitted 2m ago · Exam 3"
>
  <GradePill grade="B" />
</SubmissionCard>
```
