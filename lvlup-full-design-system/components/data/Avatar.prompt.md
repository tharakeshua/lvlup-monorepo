# Avatar

User avatar showing an image (`src`/`alt`) or `initials` fallback. Use
`size="sm"` or `size="lg"` to scale. Wrap multiple in `AvatarGroup` for an
overlapping stack.

```jsx
<Avatar initials="AS" />
<Avatar src="/u/asha.jpg" alt="Asha" size="lg" />

<AvatarGroup>
  <Avatar initials="AS" />
  <Avatar initials="DV" />
  <Avatar initials="+3" />
</AvatarGroup>
```
