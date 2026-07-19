# StoryPointTrack

Renders a horizontal learning path of `StoryPointNode`s with connectors between
them. Each connector is marked done when its preceding node is `mastered`. Pass
`nodes` as an array of `{ state, label }`.

```jsx
<StoryPointTrack
  nodes={[
    { state: "mastered", label: "Arrays" },
    { state: "mastered", label: "Linked Lists" },
    { state: "in-progress", label: "Trees" },
    { state: "not-started", label: "Graphs" },
    { state: "locked", label: "DP" },
  ]}
/>
```
