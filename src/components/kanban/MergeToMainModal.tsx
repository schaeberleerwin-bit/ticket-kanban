"use client";

import { useState } from "react";
import { Ticket } from "@/store/ticket-store";
import { GitMerge, GitBranch, X, Circle, CheckCircle2 } from "lucide-react";

interface Props {
  doneTickets: Ticket[];
  projectId: string;
  onClose: () => void;
}

type StepState = { label: string; detail: string; done: boolean; active: boolean };

export function MergeToMainModal({ doneTickets, projectId, onClose }: Props) {
  const [steps, setSteps] = useState<StepState[]>([]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withBranch = doneTickets.filter((t) => t.branchName);

  function buildSteps(): StepState[] {
    return [
      { label: "Branches ermitteln", detail: `${withBranch.length} Branches mit Commits`, done: false, active: false },
      { label: "git checkout main", detail: "Wechsel auf main-Branch", done: false, active: false },
      ...withBranch.map((t) => ({
        label: `Merge ${t.branchName}`,
        detail: t.title,
        done: false,
        active: false,
      })),
      { label: "git push origin main", detail: "Remote aktualisiert", done: false, active: false },
    ];
  }

  async function runMerge() {
    setRunning(true);
    setError(null);
    const initial = buildSteps();
    setSteps(initial);

    try {
      const res = await fetch("/api/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Merge fehlgeschlagen");

      // Animate through steps using returned timing
      const delays = initial.map(() => 600 + Math.random() * 400);
      let cumulative = 0;
      delays.forEach((delay, i) => {
        cumulative += delay;
        setTimeout(() => {
          setSteps((prev) =>
            prev.map((s, idx) =>
              idx < i ? { ...s, done: true, active: false } :
              idx === i ? { ...s, active: true } : s
            )
          );
          if (i === delays.length - 1) {
            setTimeout(() => {
              setSteps((prev) => prev.map((s) => ({ ...s, done: true, active: false })));
              setRunning(false);
              setFinished(true);
            }, delay);
          }
        }, cumulative);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRunning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !running && onClose()}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <GitMerge size={20} className="text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Merge to main</h2>
          </div>
          {!running && (
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 mb-5 px-3 py-2 bg-gray-50 rounded-lg text-sm">
          <GitBranch size={14} className="text-gray-400 shrink-0" />
          <span className="text-gray-500 font-mono text-xs">
            feature/* → <span className="text-gray-900 font-semibold">main</span>
          </span>
          <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
            {withBranch.length} Branches
          </span>
        </div>

        {withBranch.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-4 mb-4">
            Keine Done-Tickets mit Branch-Namen gefunden.
          </div>
        )}

        {steps.length > 0 && (
          <div className="space-y-3 mb-5">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {step.done ? (
                    <CheckCircle2 size={15} className="text-green-500" />
                  ) : step.active ? (
                    <div className="w-[15px] h-[15px] rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
                  ) : (
                    <Circle size={15} className="text-gray-200" />
                  )}
                </div>
                <div>
                  <div className={`text-sm font-medium ${step.done || step.active ? "text-gray-900" : "text-gray-300"}`}>
                    {step.label}
                  </div>
                  {(step.done || step.active) && (
                    <div className="text-xs text-gray-400 mt-0.5">{step.detail}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {finished ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <div className="flex items-center gap-2 text-green-600 font-semibold">
              <CheckCircle2 size={18} />
              Merge erfolgreich!
            </div>
            <p className="text-xs text-gray-400">main ist auf dem neuesten Stand.</p>
            <button onClick={onClose} className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors">
              Schließen
            </button>
          </div>
        ) : (
          <button
            onClick={runMerge}
            disabled={running || withBranch.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition-colors"
          >
            <GitMerge size={15} />
            {running ? "Merge läuft..." : "Jetzt mergen"}
          </button>
        )}
      </div>
    </div>
  );
}
