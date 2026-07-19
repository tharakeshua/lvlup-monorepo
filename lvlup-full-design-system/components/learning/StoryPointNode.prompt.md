# StoryPointNode

A single node in a learning path. Renders a numbered circle for
`not-started`/`in-progress`, a check for `mastered`, and a lock for `locked`.
Usually composed by `StoryPointTrack` rather than used directly.

```jsx
<StoryPointNode state="in-progress" index={3} label="Binary Trees" />
```
