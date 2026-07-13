import type { QuestionStatus, StoryPointSection } from '@levelup/shared-types';
import { SkipForward } from 'lucide-react';

interface QuestionNavigatorProps {
  questionOrder: string[];
  currentIndex: number;
  questionStatuses: Record<string, QuestionStatus>;
  onNavigate: (index: number) => void;
  /** Section mapping: itemId → sectionId */
  sectionMapping?: Record<string, string>;
  /** Available sections for labeling */
  sections?: StoryPointSection[];
}

const statusColors: Record<QuestionStatus, string> = {
  not_visited: 'bg-muted text-muted-foreground',
  not_answered: 'bg-red-400 text-white',
  answered: 'bg-emerald-500 text-white',
  marked_for_review: 'bg-amber-400 text-white',
  answered_and_marked: 'bg-purple-500 text-white',
};

/** Status symbols for accessibility (not color-only indicators) */
const statusSymbols: Record<QuestionStatus, string> = {
  not_visited: '',
  not_answered: '?',
  answered: '\u2713',
  marked_for_review: '\u2691',
  answered_and_marked: '\u2713\u2691',
};

const statusLabels: Record<QuestionStatus, string> = {
  not_visited: 'Not Visited',
  not_answered: 'Not Answered',
  answered: 'Answered',
  marked_for_review: 'Marked for Review',
  answered_and_marked: 'Answered & Marked',
};

export default function QuestionNavigator({
  questionOrder,
  currentIndex,
  questionStatuses,
  onNavigate,
  sectionMapping,
  sections,
}: QuestionNavigatorProps) {
  const order = Array.isArray(questionOrder) ? questionOrder : [];
  // Group questions by section if section mapping is available
  const hasSections = sectionMapping && sections && sections.length > 0;
  const sectionMap = new Map(sections?.map((s) => [s.id, s]) ?? []);

  // Build section groups
  const sectionGroups: Array<{ sectionId: string | null; title: string; questionIndices: number[] }> = [];

  if (hasSections) {
    const groupMap = new Map<string | null, number[]>();
    const groupOrder: Array<string | null> = [];

    order.forEach((qId, index) => {
      const sectionId = sectionMapping[qId] ?? null;
      if (!groupMap.has(sectionId)) {
        groupMap.set(sectionId, []);
        groupOrder.push(sectionId);
      }
      groupMap.get(sectionId)!.push(index);
    });

    for (const sectionId of groupOrder) {
      const section = sectionId ? sectionMap.get(sectionId) : null;
      sectionGroups.push({
        sectionId,
        title: section?.title ?? 'General',
        questionIndices: groupMap.get(sectionId) ?? [],
      });
    }
  }

  // Find first unanswered question
  const firstUnansweredIndex = order.findIndex((qId) => {
    const status = questionStatuses[qId] ?? 'not_visited';
    return status === 'not_visited' || status === 'not_answered' || status === 'marked_for_review';
  });

  const renderQuestionButton = (qId: string, index: number) => {
    const status = questionStatuses[qId] ?? 'not_visited';
    const symbol = statusSymbols[status];
    const isCurrent = index === currentIndex;

    return (
      <button
        key={qId}
        onClick={() => onNavigate(index)}
        aria-label={`Question ${index + 1}: ${statusLabels[status]}`}
        aria-current={isCurrent ? 'step' : undefined}
        title={statusLabels[status]}
        className={`relative h-10 w-10 sm:h-9 sm:w-9 rounded text-xs font-medium transition-all ${statusColors[status]} ${
          isCurrent ? 'ring-2 ring-primary ring-offset-1' : ''
        }`}
      >
        {index + 1}
        {symbol && (
          <span className="absolute -top-0.5 -right-0.5 text-[8px] leading-none" aria-hidden="true">
            {symbol}
          </span>
        )}
      </button>
    );
  };

  const renderSectionProgress = (indices: number[]) => {
    const answered = indices.filter((i) => {
      const status = questionStatuses[order[i]] ?? 'not_visited';
      return status === 'answered' || status === 'answered_and_marked';
    }).length;
    return (
      <span className="text-xs text-muted-foreground">
        {answered}/{indices.length}
      </span>
    );
  };

  return (
    <div role="navigation" aria-label="Question navigator" className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Questions</h4>
        {firstUnansweredIndex >= 0 && firstUnansweredIndex !== currentIndex && (
          <button
            onClick={() => onNavigate(firstUnansweredIndex)}
            className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
            title="Jump to next unanswered question"
          >
            <SkipForward className="h-3 w-3" />
            Unanswered
          </button>
        )}
      </div>

      {hasSections ? (
        // Section-grouped view
        <div className="space-y-3">
          {sectionGroups.map((group) => (
            <div key={group.sectionId ?? 'general'}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-foreground truncate">
                  {group.title}
                </span>
                {renderSectionProgress(group.questionIndices)}
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {group.questionIndices.map((index) =>
                  renderQuestionButton(order[index], index),
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Flat view (no sections)
        <div className="grid grid-cols-5 gap-1.5">
          {order.map((qId, index) => renderQuestionButton(qId, index))}
        </div>
      )}

      {/* Legend */}
      <div className="space-y-1 pt-2 border-t">
        {Object.entries(statusLabels).map(([status, label]) => (
          <div key={status} className="flex items-center gap-2 text-xs">
            <span className={`inline-flex items-center justify-center h-4 w-4 rounded text-[8px] ${statusColors[status as QuestionStatus]}`}>
              {statusSymbols[status as QuestionStatus] || '\u00B7'}
            </span>
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
