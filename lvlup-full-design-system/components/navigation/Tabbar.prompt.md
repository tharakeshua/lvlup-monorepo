# Tabbar

Mobile bottom tab navigation. Each item in `items` renders a lucide `icon` above
a `label`. Mark the current tab with `active` (applies `aria-current="page"`).

```jsx
<Tabbar
  items={[
    { icon: "home", label: "Home", href: "/", active: true },
    { icon: "boxes", label: "Spaces", href: "/spaces" },
    { icon: "trophy", label: "Ranks", href: "/leaderboard" },
    { icon: "user", label: "Profile", href: "/me" },
  ]}
/>
```
