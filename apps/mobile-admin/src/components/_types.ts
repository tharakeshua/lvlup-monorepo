/**
 * Shared prop contracts for the Lyceum RN component library.
 *
 * This file is the STABLE API SURFACE that every screen lane codes against. Stub
 * exports (this commit) and the fleshed-out implementations share these types, so
 * a screen written against the stubs keeps compiling when the real components land.
 */
import type { ReactNode } from "react";
import type { GestureResponderEvent, StyleProp, TextInputProps, ViewStyle } from "react-native";

/** Every component accepts a NativeWind className. */
export interface Styleable {
  className?: string;
}

export type WithChildren<P = unknown> = P & { children?: ReactNode };

// --- Icon -------------------------------------------------------------------
/** lucide-react-native icon name in kebab-case (e.g. "book-open", "flame"). */
export type IconName = string;

export interface IconProps extends Styleable {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// --- primitives -------------------------------------------------------------
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "spark";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Styleable {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  disabled?: boolean;
  leadingIcon?: IconName | ReactNode;
  trailingIcon?: IconName | ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  children?: ReactNode;
}

export interface IconButtonProps extends Styleable {
  icon: IconName | ReactNode;
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "solid" | "subtle" | "danger";
  solid?: boolean;
  disabled?: boolean;
  onPress?: (e: GestureResponderEvent) => void;
}

export interface ScreenProps extends Styleable {
  children?: ReactNode;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
  /** className applied to the scroll content container. */
  contentClassName?: string;
  /** Safe-area edges to pad (default top+bottom). */
  edges?: Array<"top" | "right" | "bottom" | "left">;
  /** Background tint (default canvas). */
  background?: "canvas" | "surface";
}

export interface CardProps extends Styleable {
  children?: ReactNode;
  interactive?: boolean;
  onPress?: (e: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
}

// --- data / status ----------------------------------------------------------
export type BadgeVariant = "brand" | "neutral" | "success" | "warning" | "error" | "info" | "spark";

export interface BadgeProps extends Styleable {
  variant?: BadgeVariant;
  dot?: boolean;
  icon?: IconName | ReactNode;
  children?: ReactNode;
}

export interface ChipProps extends Styleable {
  active?: boolean;
  removable?: boolean;
  onPress?: (e: GestureResponderEvent) => void;
  onRemove?: () => void;
  leadingIcon?: IconName | ReactNode;
  children?: ReactNode;
}

export interface PillProps extends Styleable {
  variant?: BadgeVariant;
  children?: ReactNode;
}

export interface AvatarProps extends Styleable {
  uri?: string;
  /** Alias for `uri` to match the web component prop. */
  src?: string;
  initials?: string;
  size?: "sm" | "md" | "lg" | "xl" | number;
}

export interface ProgressBarProps extends Styleable {
  /** 0–100. */
  value?: number;
  variant?: "brand" | "spark" | "success" | "warning" | "error";
  /** Bar height in px (default 8). */
  height?: number;
  trackClassName?: string;
}

export interface RingProps extends Styleable {
  /** 0–100. */
  value?: number;
  size?: number;
  strokeWidth?: number;
  /** Override fill color (defaults to brand). */
  color?: string;
  label?: ReactNode;
  children?: ReactNode;
}

export interface StatTileProps extends Styleable {
  label?: ReactNode;
  value?: ReactNode;
  delta?: ReactNode;
  trend?: "up" | "down" | "flat";
  icon?: IconName | ReactNode;
}

export interface ListRowProps extends Styleable {
  title?: ReactNode;
  /** Secondary line. `sub` is an accepted alias. */
  subtitle?: ReactNode;
  sub?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Show a chevron affordance on the right (default true when onPress set). */
  chevron?: boolean;
  onPress?: (e: GestureResponderEvent) => void;
}

export interface SectionHeaderProps extends Styleable {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned actions. `action` and `right` are accepted aliases. */
  actions?: ReactNode;
  action?: ReactNode;
  right?: ReactNode;
}

export interface DividerProps extends Styleable {
  vertical?: boolean;
}

export interface SkeletonProps extends Styleable {
  width?: number | string;
  height?: number | string;
  radius?: number;
  variant?: "text" | "circle" | "rect";
}

export interface EmptyStateProps extends Styleable {
  icon?: IconName | ReactNode;
  title?: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}

// --- navigation -------------------------------------------------------------
export interface TabbarItem {
  key: string;
  icon: IconName;
  label: ReactNode;
  active?: boolean;
  badge?: number;
}

export interface TabbarProps extends Styleable {
  items?: TabbarItem[];
  activeKey?: string;
  onTabPress?: (key: string) => void;
}

export interface TopBarProps extends Styleable {
  title?: ReactNode;
  subtitle?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  /** Render a back chevron on the left; calls onBack on press. */
  onBack?: () => void;
  /** Transparent background (over hero content). */
  transparent?: boolean;
}

// --- overlays ---------------------------------------------------------------
export interface SheetProps extends Styleable {
  open?: boolean;
  onClose?: () => void;
  title?: ReactNode;
  /** Slide-in edge (default 'bottom'). */
  side?: "bottom" | "right" | "left";
  children?: ReactNode;
}

// --- forms ------------------------------------------------------------------
export interface TextFieldProps extends Omit<TextInputProps, "style">, Styleable {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  leadingIcon?: IconName | ReactNode;
  trailingIcon?: IconName | ReactNode;
}

export interface SearchFieldProps extends Styleable {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  autoFocus?: boolean;
}

// --- gamification -----------------------------------------------------------
export interface XPChipProps extends Styleable {
  /** XP amount. `value` is an accepted alias. */
  xp?: number;
  value?: number;
}

export interface StreakChipProps extends Styleable {
  days?: number;
}

// --- item-render kit (learning view) ---------------------------------------
/** Loose shape of a UnifiedItem as delivered by @levelup/query (answer-key stripped). */
export interface UnifiedItemLike {
  id?: string;
  type?: string; // ITEM_TYPES: question | material | interactive | assessment | ...
  title?: string;
  prompt?: string;
  basePoints?: number;
  payload?: Record<string, unknown>;
  // Some readers flatten payload onto the item; support both.
  questionData?: Record<string, unknown>;
  materialData?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MaterialBlockProps extends Styleable {
  /** A material UnifiedItem, or its materialData payload directly. */
  item?: UnifiedItemLike;
  /** Loosely typed — SDK reads deliver `unknown`; the kit guards at runtime. */
  materialData?: unknown;
}

/** The learner's in-progress answer for a question, shape depends on questionType. */
export type QuestionAnswer = unknown;

export interface QuestionViewProps extends Styleable {
  item?: UnifiedItemLike;
  /** Loosely typed — SDK reads deliver `unknown`; the kit guards at runtime. */
  questionData?: unknown;
  /** Controlled answer value. */
  value?: QuestionAnswer;
  onChange?: (answer: QuestionAnswer) => void;
  disabled?: boolean;
  /** Render correctness/result state (post-submit review). */
  showResult?: boolean;
  /** Result metadata when showResult is true. */
  result?: {
    correct?: boolean;
    correctAnswer?: unknown;
    earnedPoints?: number;
    feedback?: string;
  };
}

/** Per-item mastery state in the item-viewer progress strip. */
export type AttemptItemStatus = "mastered" | "partial" | "incorrect" | "current" | "none";

export interface AttemptBarItem {
  status?: AttemptItemStatus;
  label?: ReactNode;
}

/**
 * The numbered item-progress strip at the top of the learning content view
 * (design: `NumNode` row). Tap a node to jump to that item.
 */
export interface AttemptBarProps extends Styleable {
  items?: AttemptBarItem[];
  /** Index of the active item. */
  current?: number;
  onSelect?: (index: number) => void;
}

// --- rich text / containers (lane-requested, design-specced) ---------------
export interface ContentRendererProps extends Styleable {
  /** Markdown/plain body; rendered with basic block formatting. */
  children?: ReactNode;
  /** Raw markdown string (alt to children). */
  body?: string;
  /** Enable LaTeX math rendering of $...$ / $$...$$ spans. */
  math?: boolean;
  /** Raw HTML string (best-effort; sanitized to text on RN). */
  html?: string;
}

export interface TabsItem {
  key?: string;
  label: ReactNode;
  content?: ReactNode;
}

export interface TabsProps extends Styleable {
  items?: TabsItem[];
  defaultIndex?: number;
  onChange?: (index: number) => void;
}

export interface AccordionItem {
  key?: string;
  title: ReactNode;
  content?: ReactNode;
}

export interface AccordionProps extends Styleable {
  items?: AccordionItem[];
  /** Index open by default; null/undefined = all closed. */
  defaultOpen?: number | null;
  /** Allow multiple panels open at once. */
  multiple?: boolean;
}

export interface ModalProps extends Styleable {
  open?: boolean;
  onClose?: () => void;
  title?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}

export type AlertVariant = "info" | "success" | "warning" | "error" | "brand";

export interface AlertProps extends Styleable {
  variant?: AlertVariant;
  title?: ReactNode;
  icon?: IconName | ReactNode;
  children?: ReactNode;
}

export interface BreadcrumbItem {
  label: ReactNode;
  onPress?: () => void;
}

export interface BreadcrumbProps extends Styleable {
  items?: BreadcrumbItem[];
}

// --- learning composites ----------------------------------------------------
export interface SpaceCardProps extends Styleable {
  title?: ReactNode;
  description?: ReactNode;
  /** Story points total. */
  points?: number;
  /** 0–100 progress. */
  progress?: number;
  icon?: IconName | ReactNode;
  spark?: boolean;
  onPress?: (e: GestureResponderEvent) => void;
}

export type StoryPointState = "not-started" | "in-progress" | "mastered" | "locked";

export interface StoryPointNodeProps extends Styleable {
  state?: StoryPointState;
  index?: number;
  label?: ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
}

export interface StoryPointTrackNode {
  state?: StoryPointState;
  label?: ReactNode;
}

export interface StoryPointTrackProps extends Styleable {
  nodes?: StoryPointTrackNode[];
  onSelect?: (index: number) => void;
}

// --- gamification (extended) ------------------------------------------------
export interface XPMeterProps extends Styleable {
  level?: number;
  xp?: number;
  next?: number;
}

export interface LevelBadgeProps extends Styleable {
  level?: number;
  spark?: boolean;
}

export interface StreakFlameProps extends Styleable {
  days?: number;
}

// --- assessment (shared composites) ----------------------------------------
export interface TimerBarProps extends Styleable {
  /** 0–100 elapsed/remaining fraction. */
  percent?: number;
  /** Display label e.g. "12:04". */
  time?: ReactNode;
  tone?: "normal" | "warning" | "critical";
}

export type GradeTone = "success" | "warning" | "error" | "neutral";

export interface GradePillProps extends Styleable {
  /** e.g. "8 / 10" or "A". */
  grade?: ReactNode;
  tone?: GradeTone;
  icon?: IconName | ReactNode;
}

// --- admin composites -------------------------------------------------------
/** Status tones map onto Badge variants + a default lucide icon. */
export type StatusTone = "success" | "warning" | "error" | "info" | "neutral" | "brand";

export interface StatusPillProps extends Styleable {
  /**
   * Semantic status string (active/published/invited/pending/archived/
   * suspended/draft/failed/…). Auto-maps to a tone + icon + title-cased label.
   * Unknown strings render neutral with the raw text.
   */
  status?: string;
  /** Override the auto-derived tone. */
  tone?: StatusTone;
  /** Override/force an icon (`false` hides it). */
  icon?: IconName | ReactNode | false;
  /** Override the displayed label (defaults to the title-cased status). */
  label?: ReactNode;
  children?: ReactNode;
}

/** Admin roles map onto a Badge variant + icon. Free strings allowed. */
export type AdminRole =
  | "admin"
  | "tenant_admin"
  | "owner"
  | "super_admin"
  | "teacher"
  | "staff"
  | "student"
  | "parent"
  | (string & {});

export interface RoleBadgeProps extends Styleable {
  role?: AdminRole;
  /** Override the displayed label (defaults to a humanised role). */
  label?: ReactNode;
  /** Override the icon (`false` hides it). */
  icon?: IconName | ReactNode | false;
}

export interface MetricTrend {
  direction?: "up" | "down" | "flat";
  label?: ReactNode;
  /** Override tone; defaults from direction (up=success, down=error). */
  tone?: StatusTone;
}

export interface MetricCardProps extends Styleable {
  label?: ReactNode;
  value?: ReactNode;
  icon?: IconName | ReactNode;
  /** Trend descriptor rendered under the value. */
  trend?: MetricTrend;
  /** Plain caption under the value (alternative to `trend`). */
  caption?: ReactNode;
  /** Tint the leading icon (`brand` default, `spark`, or `none`). */
  accent?: "brand" | "spark" | "none";
  onPress?: (e: GestureResponderEvent) => void;
}

export interface KpiGridProps extends Styleable {
  /** Metric definitions; each becomes a `MetricCard`. */
  items?: MetricCardProps[];
  /** Columns per row (default 2). */
  columns?: number;
  /** Pre-built cells (used when `items` is omitted). */
  children?: ReactNode;
}

export interface RosterRowProps extends Styleable {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Avatar initials (derived from a string `title` when omitted). */
  initials?: string;
  avatarUri?: string;
  /** Right-aligned status string → renders a `StatusPill`. */
  status?: string;
  statusTone?: StatusTone;
  /** Meta tags under the subtitle (e.g. subjects, classes). */
  tags?: ReactNode[];
  /** Replace the default avatar. */
  leading?: ReactNode;
  /** Extra trailing content (between status and chevron). */
  trailing?: ReactNode;
  chevron?: boolean;
  selected?: boolean;
  onPress?: (e: GestureResponderEvent) => void;
}

export interface DataTableColumn<T = Record<string, unknown>> {
  key: string;
  header?: ReactNode;
  /** Render the cell from the row record. */
  render?: (row: T, index: number) => ReactNode;
  /** Field accessor used when `render` is absent. */
  accessor?: (row: T) => ReactNode;
  /** Use this column as the row title on mobile. */
  primary?: boolean;
  /** Render the value in tabular mono. */
  mono?: boolean;
}

export interface DataTableProps<T = Record<string, unknown>> extends Styleable {
  columns?: DataTableColumn<T>[];
  rows?: T[];
  keyExtractor?: (row: T, index: number) => string;
  onRowPress?: (row: T, index: number) => void;
  /** Shown when `rows` is empty and not loading. */
  empty?: ReactNode;
  /** Render shimmer rows instead of data. */
  loading?: boolean;
  skeletonRows?: number;
}

export interface SegmentedTabItem {
  key: string;
  label: ReactNode;
  /** Count pill (e.g. live row totals). */
  count?: number;
  icon?: IconName | ReactNode;
}

export interface SegmentedTabsProps extends Styleable {
  items?: SegmentedTabItem[];
  value?: string;
  onChange?: (key: string) => void;
  /** Distribute tabs to full width (each flex-1). */
  block?: boolean;
}

export interface FilterControl {
  key: string;
  label: ReactNode;
  icon?: IconName | ReactNode;
  active?: boolean;
  onPress?: () => void;
}

export interface FilterBarProps extends Styleable {
  /** Search value (controlled). */
  search?: string;
  onSearch?: (text: string) => void;
  searchPlaceholder?: string;
  onClearSearch?: () => void;
  /** Filter pills/selects rendered below the search field. */
  filters?: FilterControl[];
  /** Right-aligned trailing slot next to search (e.g. export button). */
  trailing?: ReactNode;
  /** Extra custom controls appended after the filter pills. */
  children?: ReactNode;
}
