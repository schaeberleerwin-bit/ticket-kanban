"use client";

import { useEffect, useState } from "react";
import { useTicketStore } from "@/store/ticket-store";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { MergeToMainModal } from "@/components/kanban/MergeToMainModal";
import { Header } from "@/components/Header";
import { FolderGit2, Sparkles, GitMerge } from "lucide-react";

export default function KanbanDashboard() {
  const { fetchProjects, fetchTickets, projects, tickets, activeProjectId, isLoading, error } = useTicketStore();
  const [generatingBacklog, setGeneratingBacklog] = useState(false);
  const [backlogMsg, setBacklogMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [selectedAgent, setSelectedAgent] = useState("openclaw");
  const [showMerge, setShowMerge] = useState(false);

  // Beim Mount prüfen ob ein Job noch läuft; pollen bis fertig
  useEffect(() => {
    if (!activeProjectId) return;
    let interval: ReturnType<typeof setInterval>;

    async function poll() {
      const res = await fetch(`/api/agents/backlog?projectId=${activeProjectId}`);
      const data = await res.json();
      if (data.running) {
        setGeneratingBacklog(true);
      } else {
        setGeneratingBacklog(false);
        clearInterval(interval);
        if (data.error) {
          setBacklogMsg({ text: data.error, ok: false });
        } else if (generatingBacklog) {
          // war vorher running → jetzt fertig
          setBacklogMsg({ text: "Tickets erstellt", ok: true });
          fetchTickets(activeProjectId!);
        }
      }
    }

    poll();
    interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  async function handleGenerateBacklog() {
    if (!activeProjectId) return;
    setGeneratingBacklog(true);
    setBacklogMsg(null);
    try {
      const res = await fetch("/api/agents/backlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: activeProjectId, agentId: selectedAgent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      // Job gestartet – Polling übernimmt ab hier
    } catch (e) {
      setBacklogMsg({ text: e instanceof Error ? e.message : "Fehler", ok: false });
      setGeneratingBacklog(false);
    }
  }

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (activeProjectId) {
      fetchTickets(activeProjectId);
    }
  }, [activeProjectId, fetchTickets]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 px-6 py-6">
        {!activeProjectId ? (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
              <FolderGit2 size={32} className="text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Willkommen bei TicketFlow</h2>
            <p className="text-gray-500 mb-6 max-w-sm">
              Wähle oben ein Projekt aus oder erstelle ein neues, um loszulegen.
            </p>
            <div className="text-left bg-white rounded-xl border border-gray-200 p-4 max-w-md w-full">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">So funktioniert&apos;s:</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <span className="text-lg">📥</span>
                  <span><strong>Backlog:</strong> Neue Tickets erstellen (Kunden oder du)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-lg">🔍</span>
                  <span><strong>Feasibility:</strong> KI prüft Machbarkeit + verfeinert Plan</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-lg">⚡</span>
                  <span><strong>Progress:</strong> KI entwickelt + committet den Code</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-lg">🧪</span>
                  <span><strong>QA:</strong> KI prüft Qualität</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-lg">✅</span>
                  <span><strong>Done:</strong> Automatisch nach bestandener QA</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {projects.find((p) => p.id === activeProjectId)?.name}
                </h1>
                <p className="text-sm text-gray-500">
                  Ziehe Tickets per Drag & Drop zwischen den Spalten
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  <option value="openclaw">OpenClaw</option>
                  <option value="claude-code">Claude Code</option>
                  <option value="codex">Codex</option>
                </select>
                <button
                  onClick={handleGenerateBacklog}
                  disabled={generatingBacklog}
                  className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Sparkles size={15} />
                  {generatingBacklog ? "Denkt nach…" : "Backlog generieren"}
                </button>
                {backlogMsg && (
                  <span className={`text-xs px-2 py-1 rounded-full ${backlogMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                    {backlogMsg.text}
                  </span>
                )}
                {(() => {
                  const doneCount = tickets.filter((t) => t.status === "done").length;
                  return (
                    <button
                      onClick={() => setShowMerge(true)}
                      className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <GitMerge size={15} />
                      Merge to main
                      {doneCount > 0 && (
                        <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">{doneCount}</span>
                      )}
                    </button>
                  );
                })()}
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Live
                </span>
              </div>
            </div>
            <KanbanBoard />
          </>
        )}
      </main>

      {showMerge && activeProjectId && (
        <MergeToMainModal
          doneTickets={tickets.filter((t) => t.status === "done")}
          projectId={activeProjectId}
          onClose={() => setShowMerge(false)}
        />
      )}
    </div>
  );
}
