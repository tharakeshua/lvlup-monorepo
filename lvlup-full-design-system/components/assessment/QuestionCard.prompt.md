# QuestionCard

An assessment question shell with a type tag, point value, and prompt. Compose
`Option` children to render the answer choices and their states.

```jsx
<QuestionCard
  type="Multiple choice"
  points={2}
  prompt="Which data structure offers O(1) average lookup?"
>
  <Option marker="A">Array</Option>
  <Option marker="B" selected state="correct">
    Hash map
  </Option>
  <Option marker="C" state="incorrect">
    Linked list
  </Option>
  <Option marker="D">Binary tree</Option>
</QuestionCard>
```
