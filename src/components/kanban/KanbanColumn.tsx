"use client";

import { useState } from "react";
import { Ticket, TicketStatus } from "@/store/ticket-store";
import { TicketCard } from "./TicketCard";
import { useTicketStore } from "@/store/ticket-store";
import { Plus } from "lucide-react";
import { CreateTicketModal } from "./CreateTicketModal";

interface Props {
  id: TicketStatus;
  label: string;
  emoji: string;
  color: string;
  tickets: Ticket[];
  onRefresh: () => void;
}

export function KanbanColumn({ id, label, emoji, color, tickets, onRefresh }: Props) {
  const { moveTicket } = useTicketStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const ticketId = e.dataTransfer.getData("text/plain");
    if (ticketId) {
      await moveTicket(ticketId, id);
      onRefresh();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  return (
    <>
      <div
        className={`flex flex-col w-72 flex-shrink-0 rounded-xl ${color} border border-black/5 min-h-[500px]`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Column Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-black/5">
          <div className="flex items-center gap-2">
            <span className="text-lg">{emoji}</span>
            <span className="font-semibold text-sm text-gray-800">{label}</span>
            <span className="bg-black/10 text-black/50 text-xs px-1.5 py-0.5 rounded-full font-medium">
              {tickets.length}
            </span>
          </div>
          {id === "backlog" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-gray-400 hover:text-gray-700 hover:bg-black/5 p-1 rounded-lg transition-colors"
              title="Ticket erstellen"
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        {/* Drop indicator */}
        {isDragOver && (
          <div className="h-1 bg-blue-400 rounded-full mx-2 mt-2 animate-pulse" />
        )}

        {/* Tickets */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
          {tickets.length === 0 && !isDragOver && (
            <div className="text-center py-8 text-gray-400 text-sm">
              {id === "backlog" ? "＋ Ticket erstellen" : "Hierher verschieben"}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateTicketModal
          defaultStatus="backlog"
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            onRefresh();
          }}
        />
      )}
    </>
  );
}
