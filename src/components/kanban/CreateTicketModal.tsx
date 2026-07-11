"use client";

import { useState } from "react";
import { useTicketStore, Priority } from "@/store/ticket-store";
import { X } from "lucide-react";

interface Props {
  defaultStatus?: string;
  initialData?: { id: string; title: string; description: string; priority: Priority };
  isEdit?: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "low", label: "🟢 Low", color: "border-gray-300" },
  { value: "medium", label: "🔵 Medium", color: "border-blue-400" },
  { value: "high", label: "🟠 High", color: "border-orange-400" },
  { value: "critical", label: "🔴 Critical", color: "border-red-500" },
];

export function CreateTicketModal({ defaultStatus = "backlog", initialData, isEdit = false, onClose, onCreated }: Props) {
  const { createTicket, updateTicket, activeProjectId } = useTicketStore();
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [priority, setPriority] = useState<Priority>(initialData?.priority || "medium");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEdit && initialData?.id) {
        await updateTicket(initialData.id, { title: title.trim(), description, priority });
      } else {
        await createTicket({ title: title.trim(), description, priority, status: defaultStatus as "backlog", projectId: activeProjectId });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? "Ticket bearbeiten" : "Neues Ticket"}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Titel *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Was muss erledigt werden?"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Beschreibung</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detaillierte Beschreibung, Anforderungen, Akzeptanzkriterien..."
                rows={5}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder:text-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Priorität</label>
              <div className="grid grid-cols-4 gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                      priority === p.value
                        ? `${p.color} bg-blue-50 text-blue-700 ring-2 ring-blue-300`
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-900 hover:bg-gray-100 rounded-lg font-semibold text-sm transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-semibold text-sm transition-colors"
              >
                {isSubmitting ? "Speichern..." : isEdit ? "Speichern" : "Erstellen"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
