"use client";
import type { CardWithMeta, Stage } from "@/lib/types";
import { STAGE_LABELS, STAGES } from "@/lib/types";
import KanbanCard from "./KanbanCard";

const STAGE_BG: Record<Stage, string> = {
  idea: "bg-stage-idea",
  design: "bg-stage-design",
  build: "bg-stage-build",
  test: "bg-stage-test",
  ship: "bg-stage-ship",
};

export default function KanbanColumn({
  stage,
  cards,
  onCardClick,
  onMoveCard,
  onAddCard,
  loading,
}: {
  stage: Stage;
  cards: CardWithMeta[];
  onCardClick: (id: number) => void;
  onMoveCard: (cardId: number, toStage: Stage) => void;
  onAddCard: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const cardId = Number(e.dataTransfer.getData("text/card-id"));
        if (cardId) onMoveCard(cardId, stage);
      }}
    >
      <div className={`px-4 py-2.5 ${STAGE_BG[stage]} border-b border-slate-200 flex items-center justify-between`}>
        <div>
          <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">{STAGE_LABELS[stage]}</h2>
          <p className="text-xs text-slate-600">{cards.length} {cards.length === 1 ? "card" : "cards"}</p>
        </div>
        <button
          onClick={onAddCard}
          className="text-slate-700 hover:text-slate-900 text-xl leading-none"
          title={`Add card to ${STAGE_LABELS[stage]}`}
        >+</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 thin-scroll min-h-[120px]">
        {loading ? (
          <div className="space-y-2">
            <div className="h-16 rounded-lg bg-slate-100 animate-pulse" />
            <div className="h-16 rounded-lg bg-slate-100 animate-pulse" />
          </div>
        ) : cards.length === 0 ? (
          <button
            onClick={onAddCard}
            className="w-full rounded-lg border-2 border-dashed border-slate-200 px-3 py-6 text-xs text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition text-center"
          >
            Drop a card here
            <br />
            <span className="text-slate-300">or click + to add</span>
          </button>
        ) : (
          cards.map((c) => (
            <KanbanCard key={c.id} card={c} onClick={() => onCardClick(c.id)} onMove={onMoveCard} />
          ))
        )}
      </div>
    </div>
  );
}

export { STAGES };
