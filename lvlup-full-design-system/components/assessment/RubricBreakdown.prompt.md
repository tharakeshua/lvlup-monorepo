# RubricBreakdown

Lists scored rubric criteria. Each row's score tone (full / partial / zero) is
derived from `score / max`, so you only supply the raw numbers.

```jsx
<RubricBreakdown
  criteria={[
    { label: "Correctness", desc: "Handles all edge cases", score: 4, max: 4 },
    { label: "Complexity", desc: "Optimal time/space", score: 2, max: 4 },
    { label: "Style", desc: "Readable & idiomatic", score: 0, max: 2 },
  ]}
/>
```
