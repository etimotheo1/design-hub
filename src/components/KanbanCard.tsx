"use client";
import type { CardWithMeta, Stage } from "@/lib/types";
import { STAGES, STAGE_LABELS } from "@/lib/types";
import { deadlineCountdown } from "@/lib/deadline";

export default function KanbanCard({
  card,
  onClick,
  onMove,
}: {
  card: CardWithMeta;
  onClick: () => void;
  onMove: (cardId: number, toStage: Stage) => void;
}) {
  // Stage navigation: prev/next buttons. Drag-drop is also wired up at column level.
  const idx = STAGES.indexOf(card.stage as Stage);
  const prev = idx > 0 ? STAGES[idx - 1] : null;
  const next = idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
  const dl = deadlineCountdown(card.deadline);

  return (
    <div
      className="bg-white rounded-lg border border-slate-200 hover:border-brand-accent hover:shadow-cardHover shadow-card transition cursor-pointer p-3 group"
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/card-id", String(card.id))}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-xs text-slate-500 truncate flex-1">{card.project_name}</div>
        {dl && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${dl.cls}`}>{dl.label}</span>
        )}
      </div>
      <div className="text-sm font-medium text-slate-900 leading-snug">{card.title}</div>

      {(card.category || card.card_type) && (
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          {card.category && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">{card.category}</span>
          )}
          {card.card_type && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{card.card_type}</span>
          )}
        </div>
      )}

      {card.imagined_outcome && (
        <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">
          <span className="font-medium text-slate-700">Imagined: </span>
          {card.imagined_outcome}
        </p>
      )}

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {card.comment_count > 0 && <span>💬 {card.comment_count}</span>}
          {card.attachment_count > 0 && <span>📎 {card.attachment_count}</span>}
          {card.collaborator_count > 0 && <span title={`${card.collaborator_count} collaborator${card.collaborator_count === 1 ? "" : "s"}`}>👥 {card.collaborator_count}</span>}
          {card.assignee_name && (
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
              {card.assignee_name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {prev && (
            <button
              title={`Move to ${STAGE_LABELS[prev]}`}
              onClick={(e) => { e.stopPropagation(); onMove(card.id, prev); }}
              className="text-slate-400 hover:text-slate-700 text-sm"
            >←</button>
          )}
          {next && (
            <button
              title={`Move to ${STAGE_LABELS[next]}`}
              onClick={(e) => { e.stopPropagation(); onMove(card.id, next); }}
              className="text-slate-400 hover:text-slate-700 text-sm"
            >→</button>
          )}
        </div>
      </div>
    </div>
  );
}
