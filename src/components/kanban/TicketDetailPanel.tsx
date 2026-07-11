"use client";

import { useState, useEffect, useRef } from "react";
import { Ticket, useTicketStore } from "@/store/ticket-store";
import { X, Play, Clock, User, GitBranch, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { CreateTicketModal } from "./CreateTicketModal";

interface Props {
  ticket: Ticket;
  onClose: () => void;
}

const AVAILABLE_AGENTS = [
  { id: "openclaw", name: "OpenClaw", icon: "/openclaw.png" },
  { id: "claude-code", name: "Claude Code", icon: "/claude-code.png" },
  { id: "codex", name: "Codex", icon: "/codex.png" },
];

const STAGE_CONFIG = {
  feasibility: {
    label: "Feasibility prüfen",
    description: "Agent prüft ob die Aufgabe machbar ist und verfeinert den Plan.",
    buttonLabel: "Feasibility starten",
    emoji: "🔍",
  },
  develop: {
    label: "Entwicklung",
    description: "Agent implementiert die Aufgabe, commited und testet.",
    buttonLabel: "Entwicklung starten",
    emoji: "⚡",
  },
  qa: {
    label: "QA prüfen",
    description: "Agent führt Qualitätsprüfung durch.",
    buttonLabel: "QA starten",
    emoji: "🧪",
  },
};

// Geschätzte Dauer pro Stage in Sekunden (für 0–90% Fortschritt)
const STAGE_ESTIMATES: Record<string, number> = {
  feasibility: 180,
  develop: 480,
  qa: 180,
};

const STAGE_MESSAGES: Record<string, string[]> = {
  feasibility: ["Lese Codebase…", "Analysiere Anforderungen…", "Prüfe technische Machbarkeit…", "Identifiziere Risiken…", "Erstelle Feasibility-Report…"],
  develop: ["Analysiere Codebase…", "Erstelle Feature-Branch…", "Implementiere Änderungen…", "Schreibe Tests…", "Führe Tests aus…", "Commite und pushe…"],
  qa: ["Lese geänderte Dateien…", "Prüfe Code-Qualität…", "Führe Tests aus…", "Analysiere Testergebnisse…", "Erstelle QA-Report…"],
};

function AgentProgressBar({ stage, startedAt }: { stage: string; startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const messages = STAGE_MESSAGES[stage] || ["Agent arbeitet…"];
  const estimated = STAGE_ESTIMATES[stage] || 300;

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx((i) => (i + 1) % messages.length);
    }, Math.floor((estimated * 1000) / messages.length));
    return () => clearInterval(interval);
  }, [messages.length, estimated]);

  // 0–90% linear über geschätzte Zeit, danach langsam weiter bis max 98%
  const pct = elapsed <= estimated
    ? Math.round((elapsed / estimated) * 90)
    : Math.min(90 + Math.round(((elapsed - estimated) / estimated) * 8), 98);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-blue-600 font-medium">
          <Loader2 size={12} className="animate-spin" />
          <span>{messages[msgIdx]}</span>
        </div>
        <span className="text-gray-500 font-mono tabular-nums">{timeStr}</span>
      </div>
      <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{pct}%</span>
        <span>~{Math.max(0, Math.ceil((estimated - elapsed) / 60))} min verbleibend</span>
      </div>
    </div>
  );
}

export function TicketDetailPanel({ ticket, onClose }: Props) {
  const { deleteTicket, runningAgents, setRunningAgent, markAgentComplete, fetchTickets, activeProjectId } = useTicketStore();
  const [selectedAgent, setSelectedAgent] = useState("openclaw");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const fetchInFlight = useRef(false);

  const stageKey = ticket.status === "feasibility" ? "feasibility"
    : ticket.status === "progress" ? "develop"
    : ticket.status === "qa" ? "qa" : null;

  const stageConfig = stageKey ? STAGE_CONFIG[stageKey] : null;

  const thisRunning = runningAgents[ticket.id] ?? null;
  const isThisRunning = !!thisRunning;

  // Poll ticket status while agent is running (catches re-open after panel close)
  useEffect(() => {
    if (!isThisRunning) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/tickets/${ticket.id}`);
        if (!res.ok) return;
        const updated = await res.json();
        if (updated.status !== ticket.status ||
            updated.feasibilityNotes !== ticket.feasibilityNotes ||
            updated.developmentNotes !== ticket.developmentNotes ||
            updated.qaNotes !== ticket.qaNotes) {
          markAgentComplete(ticket.id);
          fetchInFlight.current = false;
          await fetchTickets(activeProjectId || undefined);
          clearInterval(poll);
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(poll);
  }, [isThisRunning, ticket.id, ticket.status, ticket.feasibilityNotes, ticket.developmentNotes, ticket.qaNotes]);

  const handleRunAgent = async () => {
    if (!stageKey || isThisRunning || fetchInFlight.current) return;
    fetchInFlight.current = true;
    setResult(null);
    setError(null);
    setRunningAgent(ticket.id, { ticketId: ticket.id, stage: stageKey, startedAt: Date.now() });

    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticket.id, stage: stageKey, agentId: selectedAgent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Agent execution failed");
      setResult(data.result ? JSON.stringify(data.result, null, 2) : "Abgeschlossen");
      markAgentComplete(ticket.id);
      await fetchTickets(activeProjectId || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRunningAgent(ticket.id, null);
    } finally {
      fetchInFlight.current = false;
    }
  };

  const handleDelete = async () => {
    if (confirm("Ticket wirklich löschen?")) {
      try {
        await deleteTicket(ticket.id);
        onClose();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
      }
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">

        {/* Running indicator bar at very top */}
        {thisRunning && (() => {
          const est = STAGE_ESTIMATES[thisRunning.stage] || 300;
          const el = Math.floor((Date.now() - thisRunning.startedAt) / 1000);
          const pct = el <= est ? Math.round((el / est) * 90) : Math.min(90 + Math.round(((el - est) / est) * 8), 98);
          return (
            <div className="h-1 bg-blue-100 overflow-hidden shrink-0">
              <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${pct}%` }} />
            </div>
          );
        })()}

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-gray-400">#{ticket.id.slice(-6)}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                ticket.status === "backlog" ? "bg-gray-100 text-gray-600" :
                ticket.status === "feasibility" ? "bg-blue-100 text-blue-700" :
                ticket.status === "progress" ? "bg-yellow-100 text-yellow-700" :
                ticket.status === "qa" ? "bg-purple-100 text-purple-700" :
                "bg-green-100 text-green-700"
              }`}>
                {ticket.status}
              </span>
              {isThisRunning && (
                <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                  <Loader2 size={11} className="animate-spin" />
                  KI arbeitet…
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-900 leading-tight">{ticket.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Beschreibung</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
              {ticket.description || <span className="italic text-gray-400">Keine Beschreibung</span>}
            </p>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Clock size={11} /> Priorität</div>
              <div className="text-sm font-medium capitalize">{ticket.priority}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><User size={11} /> Reporter</div>
              <div className="text-sm font-medium">{ticket.reporter}</div>
            </div>
            {ticket.branchName && (
              <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><GitBranch size={11} /> Branch</div>
                <div className="text-sm font-mono font-medium text-green-700">{ticket.branchName}</div>
              </div>
            )}
          </div>

          {/* Feasibility Notes */}
          {ticket.feasibilityNotes && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                🔍 Feasibility
                {ticket.feasibilityResult && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    ticket.feasibilityResult === "approved" ? "bg-green-100 text-green-700" :
                    ticket.feasibilityResult === "rejected" ? "bg-red-100 text-red-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>{ticket.feasibilityResult}</span>
                )}
              </h3>
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {ticket.feasibilityNotes}
              </div>
            </div>
          )}

          {/* Development Notes */}
          {ticket.developmentNotes && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                ⚡ Development
                {ticket.commitSha && (
                  <span className="text-xs font-mono bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    {ticket.commitSha.slice(0, 7)}
                  </span>
                )}
              </h3>
              <div className="bg-yellow-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {ticket.developmentNotes}
              </div>
            </div>
          )}

          {/* QA Notes */}
          {ticket.qaNotes && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                🧪 QA
                {ticket.qaResult && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    ticket.qaResult === "passed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>{ticket.qaResult}</span>
                )}
              </h3>
              {ticket.qaScore > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Quality Score</span>
                    <span className={`text-sm font-bold ${
                      ticket.qaScore >= 80 ? "text-green-600" :
                      ticket.qaScore >= 50 ? "text-amber-600" : "text-red-600"
                    }`}>{ticket.qaScore}/100</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${
                      ticket.qaScore >= 80 ? "bg-green-500" :
                      ticket.qaScore >= 50 ? "bg-amber-500" : "bg-red-500"
                    }`} style={{ width: `${ticket.qaScore}%` }} />
                  </div>
                </div>
              )}
              <div className="bg-purple-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {ticket.qaNotes}
              </div>
            </div>
          )}

          {/* Agent Runner */}
          {stageConfig && (
            <div className={`border rounded-xl p-4 space-y-4 ${isThisRunning ? "border-blue-300 bg-blue-50" : "border-blue-200 bg-blue-50/50"}`}>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-1">
                  {stageConfig.emoji} {stageConfig.label}
                </h3>
                <p className="text-xs text-gray-500">{stageConfig.description}</p>
              </div>

              {/* Progress bar – shown when running */}
              {thisRunning && (
                <AgentProgressBar stage={thisRunning.stage} startedAt={thisRunning.startedAt} />
              )}

              {/* Agent selector – disabled while running */}
              {!isThisRunning && (
                <div className="flex gap-2">
                  {AVAILABLE_AGENTS.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent.id)}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                        selectedAgent === agent.id
                          ? "border-blue-400 bg-blue-100 text-blue-700"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      <img src={agent.icon} alt={agent.name} className="w-5 h-5 object-contain" />
                      <span>{agent.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={handleRunAgent}
                disabled={isThisRunning}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                {isThisRunning ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Agent läuft – bitte warten…</span>
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    <span>{stageConfig.buttonLabel}</span>
                  </>
                )}
              </button>

              {result && !isThisRunning && (
                <div className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {result}
                </div>
              )}

              {error && !isThisRunning && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Done indicator */}
          {ticket.status === "done" && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
              <CheckCircle2 size={24} className="text-green-600" />
              <div>
                <div className="font-semibold text-green-800">Erledigt ✓</div>
                <div className="text-sm text-green-600">Ticket erfolgreich abgeschlossen</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={() => setShowEdit(true)}
            disabled={isThisRunning}
            className="flex-1 py-2 px-4 bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-white rounded-lg font-medium text-sm transition-colors"
          >
            Bearbeiten
          </button>
          <button
            onClick={handleDelete}
            disabled={isThisRunning}
            className="py-2 px-4 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 rounded-lg font-medium text-sm transition-colors"
          >
            Löschen
          </button>
        </div>
      </div>

      {showEdit && (
        <CreateTicketModal
          defaultStatus={ticket.status}
          initialData={{ id: ticket.id, title: ticket.title, description: ticket.description, priority: ticket.priority as "low" | "medium" | "high" | "critical" }}
          isEdit
          onClose={() => setShowEdit(false)}
          onCreated={() => {
            setShowEdit(false);
            fetchTickets(activeProjectId || undefined);
          }}
        />
      )}
    </>
  );
}
