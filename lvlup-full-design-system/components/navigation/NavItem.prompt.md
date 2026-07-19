# NavItem

A single sidebar navigation link. Renders an optional leading lucide `icon`, a
text label (`children`), and an optional trailing `badge`. Set `active` to mark
the current route (applies `aria-current="page"`).

```jsx
<nav className="sidebar__nav">
  <NavItem href="/dashboard" icon="layout-dashboard" active>
    Dashboard
  </NavItem>
  <NavItem href="/spaces" icon="boxes">
    Spaces
  </NavItem>
  <NavItem href="/inbox" icon="inbox" badge="3">
    Inbox
  </NavItem>
</nav>
```
