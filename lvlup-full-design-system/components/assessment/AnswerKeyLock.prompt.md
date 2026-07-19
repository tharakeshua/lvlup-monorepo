# AnswerKeyLock

A guard visual signalling the answer key stays server-side and is never
delivered to the client. Override `title` and `children` for context-specific
copy.

```jsx
<AnswerKeyLock title="Answer key hidden">
  Revealed only after the window closes.
</AnswerKeyLock>
```
