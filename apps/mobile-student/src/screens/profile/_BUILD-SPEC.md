# Home + Profile lane — shared build spec (READ FIRST)

You are building ONE React Native screen for `apps/mobile-student` (Expo SDK 52,
React 18, React Native 0.76, NativeWind v4). Translate a web React design
prototype into an idiomatic RN + NativeWind screen wired to real data via
`@levelup/query` hooks.

## Hard rules

- **RN only.** No DOM. Use `react-native` primitives: `View`, `Text`,
  `Pressable`, `ScrollView`, `TextInput`, `Image`, `ActivityIndicator`,
  `FlatList`. NEVER use `<div>`, `<a>`, `<span>`, `<button>`, `<input>`,
  `onClick`, `href`, `style={{ ...cssVars }}`, or `className` CSS-var strings.
- **Styling = NativeWind classes** using the Lyceum theme tokens below. Use
  `className="..."`. For one-off numeric values use RN `style={{}}` with numbers
  (e.g. `style={{ width: 48 }}`), NOT CSS strings.
- **UI components: import from `../../components`** (barrel). Do NOT build
  primitives yourself — use the provided ones. See the component API below. If a
  needed component truly isn't in the barrel, compose from RN primitives + theme
  classes.
- **Data: ONLY `@levelup/query` hooks.** NEVER import `firebase/firestore` or
  touch Firestore directly.
- **Navigation: import route consts from `../../lib/routes`** and use
  expo-router's `useRouter()`:
  `import { useRouter } from 'expo-router'; const router = useRouter(); router.push(routes.notifications());`
  If `../../lib/routes` is not yet present, still import it as
  `import { routes } from '../../lib/routes';` (the shell lane publishes it).
  Build route calls like `routes.storeSpace(id)`. Do NOT hardcode paths.
- **Every screen exports a `default` component** and handles **loading / error /
  empty / success** states.
  - loading → render `Skeleton` placeholders (matching the layout).
  - error → render `EmptyState` (icon, title, body, action=Retry button calling
    `refetch`).
  - empty → render a warm `EmptyState`.
- **Do NOT replicate the design's "Other states (for review)" / `state-band` /
  `eyebrow-state` blocks.** Those are showcase artifacts. Build the real success
  view + real loading/error/empty only.
- The design files reference dummy data (Aisha, Maya, "82%"). Replace ALL of it
  with values derived from the hook data. When a field isn't in the data, use a
  sensible fallback or omit gracefully — never crash on undefined. Hooks are
  typed `unknown`, so read defensively with helpers.

## Defensive data reading

Hook `data` is typed `unknown`. Use small local helpers, e.g.:

```ts
const num = (v: unknown, d = 0) =>
  typeof v === "number" && isFinite(v) ? v : d;
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): any => (v && typeof v === "object" ? (v as any) : {});
```

Also unwrap list envelopes: a list hook may return `T[]` OR `{ items: T[] }` OR
`{ spaces: T[] }`. Write an `asList(data)` that handles all three.

## Component API (barrel `../../components`) — import what you use

These are the names + the props you can rely on (mirror the Lyceum web
components). Pass `className?` to most. Children where sensible. Icons are by
string `name` (lucide-react-native names, kebab-case).

- `Screen` — safe-area scroll container. Wrap each screen:
  `<Screen>...</Screen>`. (Has scroll built in.)
- `TopBar` — `{ title?, left?, right?, children? }` top bar.
- `Tabbar` — bottom tab bar (shell uses it; you generally don't).
- `Card` — `{ className?, children, onPress? }` rounded surface card.
- `Button` —
  `{ variant?: 'primary'|'secondary'|'ghost'|'danger'|'spark', size?: 'sm'|'md'|'lg', leadingIcon?, trailingIcon?, onPress, disabled?, loading?, block? , children }`.
- `IconButton` —
  `{ icon: string | ReactNode, label: string (a11y), onPress, size?, variant? }`.
- `Icon` — `{ name: string, size?: number, color?: string }`
  (lucide-react-native). Use for inline icons.
- `Badge` —
  `{ variant?: 'brand'|'success'|'warning'|'error'|'info'|'spark'|'neutral', icon?, children }`.
- `Chip` / `Pill` / `Tag` — `{ active?, icon?, children, onPress? }`.
- `Avatar` — `{ initials?, uri?, size?: 'sm'|'md'|'lg' }`.
- `ProgressBar` — `{ value: number (0-100), className? }`.
- `Ring` / `Meter` — `{ value: number (0-100), size?: number, label?: string }`
  (circular progress).
- `StatTile` — `{ icon?, label, value, sub?, spark?, onPress? }` KPI tile.
- `ListRow` — `{ title, sub?, leading?, trailing?, onPress? }` tappable row.
- `SectionHeader` — `{ title, actions? }` (a row with a title + optional right
  action).
- `Sheet` / `Drawer` — `{ open, onClose, title?, children }` modal bottom sheet
  / side drawer.
- `Skeleton` —
  `{ width?, height?, variant?: 'text'|'circle'|'rect', className? }` shimmer
  placeholder.
- `EmptyState` — `{ icon?: string, title, body?, action?: ReactNode }`.
- `XPChip` — `{ xp: number, level?: number }`. `StreakChip` —
  `{ days: number }`.
- `Divider` — thin rule. `SearchField` —
  `{ value, onChangeText, placeholder?, onSubmit? }`.
- `TextField` —
  `{ label?, value, onChangeText, placeholder?, hint?, error?, disabled?, secureTextEntry?, multiline? }`.
  Treat these as a contract. If a prop you need is missing, choose the closest
  and keep usage simple; the components lane fleshes stubs out to match. Prefer
  composing visible UI from these over raw RN.

## Lyceum theme — NativeWind class tokens available (tailwind.config.js)

Colors (use as `bg-*`, `text-*`, `border-*`): `canvas`, `surface`,
`surface-sunken`, `inset`, `text-primary`, `text-secondary`, `text-muted`,
`text-on-accent`, `border-subtle`, `border-strong`, `brand`, `brand-hover`,
`brand-subtle`, `spark`, `success`, `warning`, `error`, `info`. Palettes:
`paper-{50..500}`, `ink-{400..900}`, `indigo-{50,200,400,500,600,700}`,
`marigold-{50,200,400,500,600}`, `green-{200,500,600}`, `amber-{500,600}`,
`red-{200,500,600}`, `sky-{500,600}`. Radius: `rounded-{sm,md,lg,xl,pill}`. Font
sizes: `text-{2xs,xs,sm,base,lg,xl,2xl,3xl}`. Font families: `font-display`
(Fraunces serif — headings), `font-ui` (Schibsted Grotesk — body), `font-mono`
(Spline Sans Mono — numerics/codes). Weights: use
`font-medium`/`font-semibold`/`font-bold`. Spacing: standard Tailwind scale
(`p-4`, `gap-3`, `mt-2`, etc.). The screen background is `bg-canvas`; cards are
`bg-surface`. Headings use `font-display text-text-primary`. Muted captions:
`text-text-muted text-xs`.

## Look reference

Structure comes from the design `.viewjs` you are given. The _look_ (warm paper
canvas, indigo brand, marigold spark accents, serif display headings, generous
rounding, soft borders) is Lyceum "Modern Scholarly". Keep it calm, warm, and
legible. Greetings/empty states have a friendly, encouraging tone (keep the
design's copy where it's generic, e.g. "Pick up where you left off").

## Output

Write a single `.tsx` file at the path given. Top-of-file doc comment explaining
the screen + its hooks. Strict TypeScript (the app is `strict: true`). No `any`
leaking into exported types (local `any` in defensive readers is fine but prefer
`unknown` + narrowing). Keep it self-contained and compiling against the
contracts above. Default export the screen component.
