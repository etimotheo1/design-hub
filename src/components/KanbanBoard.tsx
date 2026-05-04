"use client";
import { useEffect, useState, useCallback } from "react";
import type { CardWithMeta, Project, SessionUser, Stage } from "@/lib/types";
import { STAGES, STAGE_LABELS } from "@/lib/types";
import KanbanColumn from "./KanbanColumn";
import CardModal from "./CardModal";
import NewCardForm from "./NewCardForm";
import MoveCardDialog from "./MoveCardDialog";

export default function KanbanBoard({ currentUser }: { currentUser: SessionUser }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | "all">("all");
  const [cards, setCards] = useState<CardWithMeta[]>([]);
  const [openCardId, setOpenCardId] = useState<number | null>(null);
  const [showNewCard, setShowNewCard] = useState(false);
  const [newCardStage, setNewCardStage] = useState<Stage>("idea");
  const [loading, setLoading] = useState(true);
  const [moveDialog, setMoveDialog] = useState<{ card: CardWithMeta; toStage: Stage } | null>(null);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    if (data.ok) setProjects(data.projects);
  }, []);

  const loadCards = useCallback(async () => {
    const url = projectId === "all" ? "/api/cards" : `/api/cards?project_id=${projectId}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok) setCards(data.cards);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    setLoading(true);
    loadCards();
  }, [loadCards]);

  // Open the move dialog (every move requires a summary now).
  function moveCard(cardId: number, toStage: Stage) {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    if (card.stage === toStage) return;
    setMoveDialog({ card, toStage });
  }

  async function refreshCard(cardId: number) {
    await loadCards();
  }

  const grouped: Record<Stage, CardWithMeta[]> = {
    idea: [],
    design: [],
    build: [],
    test: [],
    ship: [],
  };
  for (const c of cards) grouped[c.stage as Stage]?.push(c);

  const counts = STAGES.map((s) => ({ stage: s, count: grouped[s].length }));

  return (
    <div className="h-full flex flex-col">
      {/* Filter + actions bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600">Project:</label>
          <select
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <div className="hidden md:flex items-center gap-1 text-xs text-slate-500">
            {counts.map((c) => (
              <span key={c.stage} className="px-2 py-0.5 rounded-full bg-slate-100">
                {STAGE_LABELS[c.stage]}: <span className="font-medium text-slate-800">{c.count}</span>
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={() => { setNewCardStage("idea"); setShowNewCard(true); }}
          className="bg-brand-ink text-white text-sm font-medium rounded-lg px-3 py-1.5 hover:bg-slate-800 shadow-sm transition"
        >
          + New card
        </button>
      </div>

      {/* Columns — horizontal scroll-snap on mobile so each stage gets full width;
          grid layout on larger screens. */}
      <div className="flex-1 flex md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 overflow-x-auto md:overflow-hidden snap-x snap-mandatory pb-2 -mx-2 md:mx-0 px-2 md:px-0">
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            cards={grouped[stage]}
            onCardClick={(id) => setOpenCardId(id)}
            onMoveCard={moveCard}
            onAddCard={() => { setNewCardStage(stage); setShowNewCard(true); }}
            loading={loading}
          />
        ))}
      </div>

      {/* Modals */}
      {openCardId !== null && (
        <CardModal
          cardId={openCardId}
          currentUser={currentUser}
          onClose={() => setOpenCardId(null)}
          onChange={() => refreshCard(openCardId)}
        />
      )}

      {showNewCard && (
        <NewCardForm
          projects={projects}
          defaultProjectId={projectId === "all" ? projects[0]?.id : projectId}
          defaultStage={newCardStage}
          onClose={() => setShowNewCard(false)}
          onCreated={() => { setShowNewCard(false); loadCards(); }}
        />
      )}

      {moveDialog && (
        <MoveCardDialog
          cardId={moveDialog.card.id}
          cardTitle={moveDialog.card.title}
          currentStage={moveDialog.card.stage as Stage}
          toStage={moveDialog.toStage}
          onClose={() => setMoveDialog(null)}
          onDone={(status) => {
            setMoveDialog(null);
            if (status === "pending") setPendingNotice("Sent for approval. The card stays put until an approver acts.");
            loadCards();
            setTimeout(() => setPendingNotice(null), 5000);
          }}
        />
      )}

      {pendingNotice && (
        <div className="fixed bottom-4 right-4 z-40 bg-amber-600 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          {pendingNotice}
        </div>
      )}
    </div>
  );
}
