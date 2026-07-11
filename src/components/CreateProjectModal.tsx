"use client";

import { useState } from "react";
import { useTicketStore } from "@/store/ticket-store";
import { X, FolderGit2, GitBranch, Copy, Check } from "lucide-react";

interface Props {
  onClose: () => void;
  onCreated: (project: { id: string; name: string }) => void;
}

function randomSecret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(20)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function CreateProjectModal({ onClose, onCreated }: Props) {
  const { createProject } = useTicketStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [webhookSecret] = useState(randomSecret);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  const webhookUrl = `${appUrl}/api/github/webhook`;

  async function copySecret() {
    await navigator.clipboard.writeText(webhookSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const project = await createProject({ name: name.trim(), description, repoUrl, githubRepo, webhookSecret });
      onCreated(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <FolderGit2 size={16} className="text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Neues Projekt</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Projektname *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. ticket-kanban, meinprojekt"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Beschreibung</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kurze Beschreibung"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Repo-Pfad (lokal)</label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/user/repo"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500"
              />
            </div>

            {/* GitHub Sync */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <GitBranch size={15} />
                GitHub Issues Sync
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">GitHub Repo (owner/repo)</label>
                <input
                  type="text"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  placeholder="schaeberledigital-gif/agent-dashboard"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500"
                />
              </div>
              {githubRepo && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Webhook URL</label>
                    <div className="flex gap-2">
                      <code className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 overflow-auto">
                        {webhookUrl}
                      </code>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Webhook Secret</label>
                    <div className="flex gap-2">
                      <code className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 font-mono truncate">
                        {webhookSecret}
                      </code>
                      <button type="button" onClick={copySecret} className="px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-white text-xs flex items-center gap-1 transition-colors">
                        {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                        {copied ? "Kopiert" : "Kopieren"}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Trage Webhook URL + Secret in GitHub → Settings → Webhooks ein. Event: <strong>Issues</strong>.
                    Braucht außerdem <code className="bg-gray-100 px-1 rounded">GITHUB_TOKEN</code> in der .env.
                  </p>
                </>
              )}
            </div>

            {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg font-semibold text-sm">
                Abbrechen
              </button>
              <button type="submit" disabled={isSubmitting || !name.trim()} className="flex-1 py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white rounded-lg font-semibold text-sm">
                {isSubmitting ? "Erstellen..." : "Erstellen"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
