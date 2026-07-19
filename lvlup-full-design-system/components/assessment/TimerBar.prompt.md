# TimerBar

A server-authoritative countdown bar for timed assessments. `time` is the
remaining clock, `percent` fills the track, and `tone="warning"|"critical"`
shifts the color as time runs low.

```jsx
<TimerBar time="12:48" percent={64} />
<TimerBar time="01:30" percent={12} tone="critical" />
```
