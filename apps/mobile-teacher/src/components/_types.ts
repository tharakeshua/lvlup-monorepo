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

// ===========================================================================
// TEACHER-SPECIFIC COMPONENTS
// The staff app adds grading / roster / analytics surfaces on top of the shared
// Lyceum kit. These types are the stable API screen lanes (classes/review/
// insights/home/more) code against.
// ===========================================================================

/** A student's standing within a class — drives status pills + tint. */
export type StudentStatus = "active" | "inactive" | "pending" | "invited";
export type TrendDir = "up" | "down" | "flat" | "na";

// --- RosterRow --------------------------------------------------------------
export interface RosterRowProps extends Styleable {
  name: string;
  initials?: string;
  avatarUri?: string;
  /** Roll number / enrollment code shown beside the name. */
  roll?: string;
  /** 0–100 mastery / completion. */
  progress?: number;
  /** 0–100 latest score (null/undefined → "—"). */
  score?: number | null;
  /** Letter grade chip (A–F). */
  grade?: string | null;
  status?: StudentStatus;
  atRisk?: boolean;
  /** e.g. "2d ago". */
  lastActive?: ReactNode;
  /** Render a leading checkbox affordance (bulk select). */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onPress?: (e: GestureResponderEvent) => void;
  trailing?: ReactNode;
}

// --- SubmissionCard (grading queue row) -------------------------------------
export type SubmissionStatus =
  | "awaiting"
  | "auto-graded"
  | "needs-review"
  | "reviewed"
  | "released"
  | "flagged"
  | "error";

export interface SubmissionCardProps extends Styleable {
  studentName: string;
  initials?: string;
  avatarUri?: string;
  /** Sub-line, e.g. "Q3 · Short answer" or "Submitted 4m ago". */
  meta?: ReactNode;
  status?: SubmissionStatus;
  /** Autograde confidence band. */
  confidence?: ConfidenceLevel;
  /** Numeric confidence 0–1 (rendered as %) when `confidence` not set. */
  confidenceScore?: number;
  /** Earned points (null → ungraded). */
  score?: number | null;
  /** Max points. */
  maxScore?: number;
  onPress?: (e: GestureResponderEvent) => void;
  trailing?: ReactNode;
}

// --- ConfidenceBadge --------------------------------------------------------
export type ConfidenceLevel = "high" | "medium" | "low";

export interface ConfidenceBadgeProps extends Styleable {
  /** Band; derived from `score` when omitted. */
  level?: ConfidenceLevel;
  /** 0–1 confidence; rendered as % and bucketed into a band. */
  score?: number;
  /** Hide the numeric % (band label only). */
  hidePercent?: boolean;
  size?: "sm" | "md";
}

// --- RubricRow / RubricBreakdown --------------------------------------------
export interface RubricCriterion {
  /** Criterion / sub-question label. */
  label: ReactNode;
  /** Points earned. */
  earned?: number;
  /** Points possible. */
  max?: number;
  /** Optional grader / AI note. */
  note?: ReactNode;
  /** Met / partial / missed — drives the tick + tint. */
  state?: "met" | "partial" | "missed";
}

export interface RubricRowProps extends Styleable {
  criterion?: RubricCriterion;
  /** Inline props (alt to passing a `criterion` object). */
  label?: ReactNode;
  earned?: number;
  max?: number;
  note?: ReactNode;
  state?: "met" | "partial" | "missed";
  /** Edit affordance (manual override). */
  onPress?: (e: GestureResponderEvent) => void;
}

export interface RubricBreakdownProps extends Styleable {
  criteria?: RubricCriterion[];
  /** Total earned (computed from criteria when omitted). */
  totalEarned?: number;
  /** Total possible (computed from criteria when omitted). */
  totalMax?: number;
  title?: ReactNode;
}

// --- ScoreInput / ScoreStepper ----------------------------------------------
export interface ScoreInputProps extends Styleable {
  value?: number | null;
  onChange?: (value: number | null) => void;
  /** Max points (shown as "/ max", clamps input). */
  max?: number;
  min?: number;
  /** Allow fractional points (e.g. 0.5). */
  step?: number;
  label?: ReactNode;
  disabled?: boolean;
  autoFocus?: boolean;
}

export interface ScoreStepperProps extends Styleable {
  value?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: ReactNode;
  disabled?: boolean;
}

// --- Charts (pure RN/SVG) ---------------------------------------------------
export interface ChartDatum {
  label?: ReactNode;
  value: number;
  /** Override bar/point color (hex). */
  color?: string;
  /** Highlight / selected state. */
  active?: boolean;
}

export interface MiniBarChartProps extends Styleable {
  data?: ChartDatum[];
  /** Bare numbers (alt to `data`). */
  values?: number[];
  height?: number;
  /** Default bar color (hex). */
  color?: string;
  /** Show value labels above each bar. */
  showValues?: boolean;
  /** Show x-axis labels under each bar. */
  showLabels?: boolean;
  /** Fixed max for the y-scale (defaults to data max). */
  maxValue?: number;
  onSelect?: (index: number) => void;
}

export interface SparklineProps extends Styleable {
  values?: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Fill the area under the line. */
  fill?: boolean;
  /** Dot on the last point. */
  showEnd?: boolean;
  strokeWidth?: number;
}

export interface DistributionSegment {
  label?: ReactNode;
  value: number;
  /** Hex color (defaults to a grade/brand ramp by index). */
  color?: string;
}

export interface DistributionBarProps extends Styleable {
  /** Single-row stacked proportions (e.g. A/B/C/D/F counts). */
  segments?: DistributionSegment[];
  /** Render as labelled rows (one bar per segment) instead of a stacked bar. */
  rows?: boolean;
  height?: number;
  /** Show count/percent beside each row (rows mode). */
  showValues?: boolean;
}

// --- MetricCard -------------------------------------------------------------
export interface MetricCardProps extends Styleable {
  label?: ReactNode;
  value?: ReactNode;
  /** Caption under the value (e.g. "of 32 students"). */
  caption?: ReactNode;
  /** Delta text e.g. "+4.2%". */
  delta?: ReactNode;
  trend?: TrendDir;
  icon?: IconName | ReactNode;
  /** Accent the whole card (e.g. warning for at-risk KPI). */
  tone?: "neutral" | "brand" | "success" | "warning" | "error";
  /** Inline trailing spark/visual (e.g. a <Sparkline/>). */
  visual?: ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
}

// --- AtRiskRow --------------------------------------------------------------
export type RiskSeverity = "high" | "medium" | "low";

export interface AtRiskRowProps extends Styleable {
  name: string;
  initials?: string;
  avatarUri?: string;
  /** Class / section label e.g. "10-A". */
  className_?: ReactNode;
  /** Humanized reasons e.g. ["Low quiz scores", "11d inactive"]. */
  reasons?: ReactNode[];
  severity?: RiskSeverity;
  /** 0–100 score (null → "—"). */
  score?: number | null;
  trend?: TrendDir;
  lastActive?: ReactNode;
  /** e.g. "Flagged 14d". */
  flagged?: ReactNode;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onPress?: (e: GestureResponderEvent) => void;
}

// --- RoleTenantPill ---------------------------------------------------------
export interface RoleTenantPillProps extends Styleable {
  /** Tenant / school name. */
  tenant?: ReactNode;
  /** Role label e.g. "Teacher", "Admin". */
  role?: ReactNode;
  /** Tenant code / initials for the leading mark. */
  code?: string;
  /** Show the dropdown chevron (multi-membership). */
  switchable?: boolean;
  onPress?: (e: GestureResponderEvent) => void;
}

// --- FilterChips ------------------------------------------------------------
export interface FilterChipOption {
  key: string;
  label: ReactNode;
  icon?: IconName | ReactNode;
  /** Optional count badge. */
  count?: number;
}

export interface FilterChipsProps extends Styleable {
  options?: FilterChipOption[];
  /** Selected key(s). Single string or array (multi). */
  value?: string | string[];
  onChange?: (value: string) => void;
  /** Allow multiple active chips. */
  multiple?: boolean;
  contentClassName?: string;
}
