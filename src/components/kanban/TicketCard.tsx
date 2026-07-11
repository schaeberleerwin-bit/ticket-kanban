"use client";

import { useState, useEffect } from "react";
import { Ticket } from "@/store/ticket-store";
import { useTicketStore } from "@/store/ticket-store";
import { GripVertical, MessageSquare, GitCommit, AlertCircle, Loader2 } from "lucide-react";
import { TicketDetailPanel } from "./TicketDetailPanel";

const STAGE_ESTIMATES: Record<string, number> = {
  feasibility: 180,
  develop: 480,
  qa: 180,
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-400",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  critical: "bg-red-600",
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  approved: { label: "✓ Machbar", color: "bg-green-100 text-green-700" },
  rejected: { label: "✗ Abgelehnt", color: "bg-red-100 text-red-700" },
  needs_work: { label: "⚠ Überarbeitung", color: "bg-yellow-100 text-yellow-700" },
  passed: { label: "✓ QA Passed", color: "bg-green-100 text-green-700" },
  failed: { label: "✗ QA Failed", color: "bg-red-100 text-red-700" },
};

interface Props {
  ticket: Ticket;
}

function AgentCardBar({ ticketId }: { ticketId: string }) {
  const { runningAgents, completedAgents } = useTicketStore();
  const [, forceUpdate] = useState(0);

  const isRunning = !!runningAgents[ticketId];
  const runningInfo = runningAgents[ticketId] ?? null;
  const completed = completedAgents[ticketId];

  // Re-render every second while running so progress moves
  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => forceUpdate((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [isRunning]);

  if (!isRunning && !completed) return null;

  if (isRunning && runningInfo) {
    const est = STAGE_ESTIMATES[runningInfo.stage] || 300;
    const elapsed = (Date.now() - runningInfo.startedAt) / 1000;
    const pct = elapsed <= est
      ? Math.round((elapsed / est) * 90)
      : Math.min(90 + Math.round(((elapsed - est) / est) * 8), 98);

    return (
      <div className="mb-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-0.5">
          <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
            <Loader2 size={10} className="animate-spin" />
            KI arbeitet…
          </span>
          <span className="text-xs text-gray-400 font-mono tabular-nums">{pct}%</span>
        </div>
        <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="mb-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs text-green-600 font-medium">Abgeschlossen</span>
          <span className="text-xs text-green-600 font-mono">100%</span>
        </div>
        <div className="h-1.5 bg-green-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full w-full" />
        </div>
      </div>
    );
  }

  return null;
}

export function TicketCard({ ticket }: Props) {
  const { deleteTicket } = useTicketStore();
  const [showDetail, setShowDetail] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", ticket.id);
    setIsDragging(true);
  };

  const handleDragEnd = () => setIsDragging(false);

  const stageIndicator = () => {
    if (ticket.feasibilityResult) {
      const badge = STATUS_BADGES[ticket.feasibilityResult];
      if (badge) return <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badge.color}`}>{badge.label}</span>;
    }
    if (ticket.qaResult) {
      const badge = STATUS_BADGES[ticket.qaResult];
      if (badge) return <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badge.color}`}>{badge.label}</span>;
    }
    return null;
  };

  const hasNotes = ticket.feasibilityNotes || ticket.developmentNotes || ticket.qaNotes;

  return (
    <>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={() => setShowDetail(true)}
        className={`bg-white rounded-lg border border-black/10 p-3 cursor-pointer hover:border-black/25 hover:shadow-sm transition-all group ${
          isDragging ? "opacity-50 rotate-2 scale-105" : ""
        }`}
      >
        {/* Priority + drag handle */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <GripVertical size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
            <div className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[ticket.priority] || "bg-gray-400"}`} title={ticket.priority} />
          </div>
          {stageIndicator()}
        </div>

        {/* Title */}
        <p className="text-sm font-medium text-gray-900 leading-snug mb-2 line-clamp-2">
          {ticket.title}
        </p>

        {/* Agent progress bar (running or 100% completed) */}
        <AgentCardBar ticketId={ticket.id} />

        {/* QA Score bar */}
        {ticket.qaScore > 0 && (
          <div className="mb-2">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs text-gray-400">QA Score</span>
              <span className={`text-xs font-semibold ${ticket.qaScore >= 80 ? "text-green-600" : ticket.qaScore >= 50 ? "text-amber-500" : "text-red-500"}`}>
                {ticket.qaScore}/100
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${ticket.qaScore >= 80 ? "bg-green-500" : ticket.qaScore >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${ticket.qaScore}%` }}
              />
            </div>
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {ticket.commitSha && (
            <div className="flex items-center gap-1 text-green-600" title={`Commit: ${ticket.commitSha}`}>
              <GitCommit size={11} />
              <span>{ticket.commitSha.slice(0, 6)}</span>
            </div>
          )}
          {hasNotes && (
            <div className="flex items-center gap-1">
              <MessageSquare size={11} />
            </div>
          )}
          {ticket.priority === "critical" && (
            <AlertCircle size={11} className="text-red-500" />
          )}
          <span className="ml-auto text-xs text-gray-400 font-mono">
            {ticket.id.slice(-6)}
          </span>
        </div>
      </div>

      {showDetail && (
        <TicketDetailPanel
          ticket={ticket}
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  );
}
