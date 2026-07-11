"use client";

import { useTicketStore, Ticket, TicketStatus } from "@/store/ticket-store";
import { KanbanColumn } from "./KanbanColumn";
import { Plus } from "lucide-react";

const COLUMNS: { id: TicketStatus; label: string; color: string; emoji: string }[] = [
  { id: "backlog", label: "Backlog", color: "bg-gray-100", emoji: "📥" },
  { id: "feasibility", label: "Feasibility", color: "bg-blue-50", emoji: "🔍" },
  { id: "progress", label: "In Progress", color: "bg-yellow-50", emoji: "⚡" },
  { id: "qa", label: "QA", color: "bg-purple-50", emoji: "🧪" },
  { id: "done", label: "Done", color: "bg-green-50", emoji: "✅" },
];

export function KanbanBoard() {
  const { tickets, isLoading, error, fetchTickets, activeProjectId } = useTicketStore();

  if (isLoading && tickets.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 animate-spin">⏳</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  const ticketsByStatus = (status: TicketStatus) =>
    tickets
      .filter((t) => t.status === status)
      .sort((a, b) => a.order - b.order);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 px-1">
      {COLUMNS.map((col) => (
        <KanbanColumn
          key={col.id}
          id={col.id}
          label={col.label}
          emoji={col.emoji}
          color={col.color}
          tickets={ticketsByStatus(col.id)}
          onRefresh={() => fetchTickets(activeProjectId || undefined)}
        />
      ))}
    </div>
  );
}
