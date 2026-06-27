# Lyceum RN Component Library — API Reference

Single import surface for every screen lane:

```tsx
import { Screen, Card, Button, QuestionView /* … */ } from "../../components";
```

All components are NativeWind-styled to the Lyceum theme (`src/theme` +
`tailwind.config.js`). Icon slots accept a **lucide kebab-case name string**
(`"book-open"`) _or_ a `ReactNode`. Status: every symbol below is fully
implemented (no stubs). `tsc --noEmit` on the app is green.

## Primitives

| Component    | Key props                                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `Screen`     | `children, scroll?=true, contentClassName?, edges?, background?:'canvas'\|'surface'` — SafeArea + (optional) ScrollView                  |
| `Card`       | `children, interactive?, onPress?`                                                                                                       |
| `Button`     | `variant?:primary\|secondary\|ghost\|danger\|spark, size?:sm\|md\|lg, leadingIcon?, trailingIcon?, loading?, block?, disabled?, onPress` |
| `IconButton` | `icon, label?, size?:sm\|md\|lg, variant?:ghost\|solid\|subtle\|danger, solid?, onPress`                                                 |
| `Divider`    | `vertical?`                                                                                                                              |
| `Icon`       | `name, size?, color?, strokeWidth?`                                                                                                      |

## Data / status

| Component                         | Key props                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `Badge`                           | `variant?:brand\|neutral\|success\|warning\|error\|info\|spark, dot?, icon?`                    |
| `Chip`                            | `active?, removable?, onPress?, onRemove?, leadingIcon?`                                        |
| `Pill` / `Tag`                    | `variant?` (alias of Badge)                                                                     |
| `Avatar`                          | `uri?\|src?, initials?, size?:sm\|md\|lg\|xl\|number`                                           |
| `ProgressBar`                     | `value(0–100), variant?, height?`                                                               |
| `ProgressRing` / `Ring` / `Meter` | `value, size?, strokeWidth?, color?, label?`                                                    |
| `StatTile` / `Stat`               | `label, value, delta?, trend?:up\|down\|flat, icon?`                                            |
| `ListRow`                         | `title, subtitle?(alias sub), leading?(alias left), trailing?(alias right), chevron?, onPress?` |
| `SectionHeader`                   | `title, subtitle?, actions?(aliases action/right)`                                              |
| `Skeleton`                        | `width?, height?, radius?, variant?:text\|circle\|rect`                                         |
| `EmptyState`                      | `icon?, title, body?, action?`                                                                  |

## Navigation / overlays

| Component    | Key props                                                         |
| ------------ | ----------------------------------------------------------------- |
| `Tabbar`     | `items:{key,icon,label,active?,badge?}[], activeKey?, onTabPress` |
| `TopBar`     | `title?, subtitle?, left?, right?, onBack?, transparent?`         |
| `Breadcrumb` | `items:{label,onPress?}[]`                                        |
| `Sheet`      | `open, onClose, title?, side?:bottom\|right\|left, children`      |
| `Drawer`     | `= Sheet` (default `side='right'`)                                |
| `Modal`      | `open, onClose, title?, footer?, children`                        |

## Forms / containers

| Component         | Key props                                                                               |
| ----------------- | --------------------------------------------------------------------------------------- |
| `TextField`       | `value, onChangeText, label?, hint?, error?, multiline?, leadingIcon?, …TextInputProps` |
| `SearchField`     | `value, onChangeText, placeholder?, onClear?`                                           |
| `Tabs`            | `items:{label,content}[], defaultIndex?, onChange?`                                     |
| `Accordion`       | `items:{title,content}[], defaultOpen?, multiple?`                                      |
| `Alert`           | `variant?:info\|success\|warning\|error\|brand, title?, icon?, children`                |
| `ContentRenderer` | `children\|body?, math?, html?` — lightweight markdown + code + LaTeX-ish text          |

## Gamification / learning / assessment

| Component         | Key props                                                                   |
| ----------------- | --------------------------------------------------------------------------- |
| `XPChip`          | `xp(alias value)`                                                           |
| `StreakChip`      | `days`                                                                      |
| `XPMeter`         | `level, xp, next`                                                           |
| `StreakFlame`     | `days`                                                                      |
| `LevelBadge`      | `level, spark?`                                                             |
| `SpaceCard`       | `title, description?, points?, progress?, icon?, spark?, onPress`           |
| `StoryPointNode`  | `state:not-started\|in-progress\|mastered\|locked, index?, label?, onPress` |
| `StoryPointTrack` | `nodes:{state,label}[], onSelect`                                           |
| `TimerBar`        | `percent(0–100), time?, tone?:normal\|warning\|critical`                    |
| `GradePill`       | `grade, tone?:success\|warning\|error\|neutral, icon?`                      |

## Item-render kit (learning view + tests runner)

| Component       | Key props                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| `MaterialBlock` | `item \| materialData` — renders materialType **text · video · pdf · link · interactive · story · rich**             |
| `QuestionView`  | `item \| questionData, value, onChange, disabled?, showResult?, result?` — renders **all 15 question types**         |
| `AttemptBar`    | `items:{status:mastered\|partial\|incorrect\|current\|none}[], current, onSelect` — the numbered item-progress strip |

### QuestionView value shapes by `questionType`

- `mcq` → `optionId: string`
- `mcaq` → `optionId[]`
- `true-false` → `boolean`
- `numerical | text | paragraph | code | audio | image_evaluation | chat_agent_question`
  → `string`
- `fill-blanks | fill-blanks-dd` → `{ [blankId]: string }`
- `matching` → `{ [left]: right }`
- `group-options` → `{ [itemId]: group }`
- `jumbled` → `number[]` (token order)

QuestionView **never shows an answer key pre-submit** (the server strips
answer-bearing fields from learner reads). Pass `showResult` +
`result:{correct,earnedPoints,correctAnswer?,feedback?}` for post-submit review
styling.

### Helpers (also exported)

`getMaterialData(item)`, `getQuestionData(item)`, `getPrompt(item)`,
`getBasePoints(item)` — tolerant extractors that normalize the `@levelup/query`
UnifiedItem (nested `payload.*` or flattened).

## Theme tokens (JS values for SVG / ActivityIndicator / inline)

```ts
import { theme, colors } from "../../components"; // or '../theme'
colors.brand; // '#423A82'  · colors.spark '#E8972B' · colors.success/error/warning/info
theme.radius / theme.spacing / theme.fontSize / theme.fontFamily;
```
