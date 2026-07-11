"use client";

import { useEffect, useState } from "react";
import { useTicketStore } from "@/store/ticket-store";
import { Settings, Plus, FolderGit2, Trash2 } from "lucide-react";
import { CreateProjectModal } from "./CreateProjectModal";

export function Header() {
  const { projects, activeProjectId, setActiveProject, fetchProjects, deleteProject } = useTicketStore();
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const handleDeleteProject = async () => {
    if (!activeProject) return;
    const confirmed = window.confirm(
      `Projekt "${activeProject.name}" wirklich löschen? Tickets bleiben erhalten, verlieren aber die Projekt-Zuordnung.`
    );
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      await deleteProject(activeProject.id);
    } catch {
      alert("Projekt löschen fehlgeschlagen.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain rounded-xl" />
          <span className="font-bold text-gray-900">TicketFlow</span>
        </div>

        {/* Project selector */}
        <div className="flex items-center gap-2">
          <FolderGit2 size={16} className="text-gray-400" />
          <select
            value={activeProjectId || ""}
            onChange={(e) => setActiveProject(e.target.value || "")}
            className="text-base font-medium border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800 min-w-[180px]"
          >
            <option value="">— Projekt wählen —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowProjectModal(true)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="Projekt erstellen"
          >
            <Plus size={16} className="text-gray-500" />
          </button>
          {activeProject && (
            <button
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="p-1.5 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              title="Projekt löschen"
            >
              <Trash2 size={16} className="text-red-500" />
            </button>
          )}
        </div>

        {activeProject && (
          <div className="text-sm text-gray-500 border-l border-gray-200 pl-4">
            {activeProject.description || activeProject.repoUrl}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {activeProjectId && (
          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
            ✓ Aktiv
          </span>
        )}
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <Settings size={18} className="text-gray-500" />
        </button>
      </div>

      {showProjectModal && (
        <CreateProjectModal
          onClose={() => setShowProjectModal(false)}
          onCreated={(project) => {
            setShowProjectModal(false);
            setActiveProject(project.id);
          }}
        />
      )}
    </header>
  );
}
