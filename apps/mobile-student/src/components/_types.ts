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
  /** Canonical home of the question/body text (UnifiedItemSchema top-level). */
  content?: string;
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
  /**
   * Item context, threaded from the viewer. Used by conversational question
   * types (`chat_agent_question`) to drive the chat backend
   * (`sendChatMessage` needs spaceId/storyPointId/itemId). itemId falls back
   * to `item.id` when not supplied.
   */
  spaceId?: string;
  storyPointId?: string;
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
  /** Override the paragraph/list text classes (e.g. question prompts). */
  textClassName?: string;
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
