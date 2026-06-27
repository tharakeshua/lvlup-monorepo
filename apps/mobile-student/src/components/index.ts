/**
 * Lyceum RN component library — public barrel.
 *
 * The single import surface for every screen lane: `import { Button, Screen, … }
 * from '../../components'`. Components are NativeWind-styled to the Lyceum theme
 * (see ../theme + tailwind.config.js) and icon slots accept a lucide
 * `name` string or a ReactNode.
 */

// primitives
export { Screen, Card, Button, IconButton, Divider } from "./primitives";

// icon
export { Icon, renderIcon } from "./Icon";

// data / status
export {
  Badge,
  Chip,
  Pill,
  Avatar,
  ProgressBar,
  ProgressRing,
  Ring,
  Meter,
  StatTile,
  Stat,
  ListRow,
  SectionHeader,
  Skeleton,
  EmptyState,
} from "./data";

// navigation
export { Tabbar, TopBar, Breadcrumb } from "./navigation";

// overlays
export { Sheet, Drawer, Modal } from "./overlays";

// forms
export { TextField, SearchField } from "./forms";

// containers
export { Tabs, Accordion, Alert, ContentRenderer } from "./containers";

// gamification
export { XPChip, StreakChip, XPMeter, StreakFlame, LevelBadge } from "./gamification";

// learning composites
export { SpaceCard, StoryPointNode, StoryPointTrack } from "./learning";

// assessment (shared)
export { TimerBar, GradePill } from "./assessment";

// item-render kit
export { MaterialBlock } from "./material-block";
export { QuestionView } from "./question-view";
export { AttemptBar } from "./attempt-bar";
export { getMaterialData, getQuestionData, getPrompt, getBasePoints } from "./item-data";

// theme re-exports (convenience for screens needing JS token values)
export { theme, colors, palette } from "../theme";

// all prop types
export type * from "./_types";

// alias: Tag === Pill (contract lists "Pill/Tag")
export { Pill as Tag } from "./data";
