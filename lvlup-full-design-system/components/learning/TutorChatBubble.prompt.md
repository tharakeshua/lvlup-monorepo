# TutorChatBubble

A single chat turn in the AI-tutor conversation. `from` drives the bubble
side/styling (`"tutor"` default, `"student"` for the learner). Optional `author`
renders a small name label above the message; the message text is `children`.

```jsx
<>
  <TutorChatBubble from="student" author="You">
    Why is mergesort O(n log n)?
  </TutorChatBubble>
  <TutorChatBubble from="tutor" author="Tutor">
    Each merge pass is O(n), and there are log n levels of merging.
  </TutorChatBubble>
</>
```
