# ConfidenceBadge

Shows how an AI grader routed a response. `level="low"` reads "Review", `med`
reads "Spot-check", `high` reads "Auto". Pass `value` to override the label
text.

```jsx
<ConfidenceBadge level="high" />
<ConfidenceBadge level="low" value="Needs review" />
```
