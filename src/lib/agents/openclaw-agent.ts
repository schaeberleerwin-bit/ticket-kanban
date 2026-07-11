/**
 * OpenClaw Agent Adapter
 *
 * Spawns `openclaw agent --local` as a subprocess per turn.
 */

import { AgentAdapter, TicketContext, FeasibilityResult, DevelopmentResult, QAResult } from "./types";
import { spawn } from "child_process";

const MODEL = process.env.OPENCLAW_MODEL || "minimax-portal/MiniMax-M2.7";

function openClawSession(prompt: string, cwd: string, timeoutMs = 300_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "openclaw",
      ["agent", "--local", "--json", "--model", MODEL, "--message", prompt],
      { cwd, timeout: timeoutMs, shell: true }
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("close", (code) => {
      if (code === 0) {
        // Try to extract text from JSON output
        try {
          const parsed = JSON.parse(stdout);
          resolve(parsed.result || parsed.output || parsed.message || stdout);
        } catch {
          resolve(stdout);
        }
      } else {
        reject(new Error(`OpenClaw exited ${code}\n${stderr}`));
      }
    });

    child.on("error", reject);
  });
}

export class OpenClawAgent implements AgentAdapter {
  readonly id = "openclaw";
  readonly name = "OpenClaw";
  readonly capabilities = {
    name: "OpenClaw Agent",
    canReadFiles: true,
    canWriteFiles: true,
    canExecuteCommands: true,
    canCommitToGit: true,
    canRunTests: true,
    model: "MiniMax-M2.7",
  };

  async assessFeasibility(ctx: TicketContext): Promise<FeasibilityResult> {
    const prompt = `Du bist der FEASIBILITY AGENT. Prüfe die folgende Aufgabe auf Machbarkeit.

REPO-PFAD: ${ctx.repoPath}
REPO-URL: ${ctx.repoUrl}

TICKET:
- ID: ${ctx.id}
- Titel: ${ctx.title}
- Beschreibung: ${ctx.description}
- Priorität: ${ctx.priority}

DEINE AUFGABE:
1. Lese relevante Dateien im Repo um den Codebase-Kontext zu verstehen
2. Prüfe ob die Aufgabe machbar ist (technisch, zeitlich, ressourcen)
3. Falls die Beschreibung zu vage ist → verfeinere den Plan und beschreibe konkrete Schritte
4. Identifiziere Risiken und blockers
5. Schätze den Aufwand in Stunden

ANTWORTE STRUKTURIERT (JSON):
{
  "result": "approved" | "rejected" | "needs_work",
  "notes": "Deine detaillierte Analyse...",
  "refinedPlan": "Verfeinerte, konkrete Aufgabenbeschreibung mit Schritten...",
  "risiken": ["Risiko 1", "Risiko 2"],
  "estimatedHours": 4
}`;

    try {
      const output = await openClawSession(prompt, ctx.repoPath, 300_000);
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          result: parsed.result || "needs_work",
          notes: parsed.notes || output,
          refinedPlan: parsed.refinedPlan || ctx.description,
          risks: parsed.risiken || [],
          estimatedHours: parsed.estimatedHours,
        };
      }
      return {
        result: "needs_work",
        notes: output,
        refinedPlan: ctx.description,
        risks: [],
      };
    } catch (err) {
      return {
        result: "needs_work",
        notes: `OpenClaw Fehler: ${err instanceof Error ? err.message : String(err)}`,
        refinedPlan: ctx.description,
        risks: ["OpenClaw CLI fehlgeschlagen"],
      };
    }
  }

  async develop(ctx: TicketContext, refinedPlan: string): Promise<DevelopmentResult> {
    const prompt = `Du bist der DEVELOPMENT AGENT. Implementiere die folgende Aufgabe.

REPO-PFAD: ${ctx.repoPath}
REPO-URL: ${ctx.repoUrl}

TICKET:
- ID: ${ctx.id}
- Titel: ${ctx.title}
- Beschreibung: ${ctx.description}
- Priorität: ${ctx.priority}

VERFEINERTER PLAN:
${refinedPlan}

DEINE AUFGABE:
1. Verstehe die bestehende Codebase (relevante Dateien lesen)
2. Erstelle einen Feature-Branch: feature/ticket-${ctx.id.slice(-6)}
3. Implementiere die Änderungen
4. Schreibe oder aktualisiere Tests
5. Führe die Tests aus
6. Commite alles mit einer aussagekräftigen Commit-Nachricht
7. Push den Branch

OUTPUT FORMAT (JSON):
{
  "success": true/false,
  "notes": "Was wurde gemacht...",
  "commitSha": "abc1234",
  "branchName": "feature/ticket-xxx",
  "testsRan": true/false,
  "testsPassed": true/false,
  "output": "Test-output oder Zusammenfassung..."
}`;

    try {
      const output = await openClawSession(prompt, ctx.repoPath, 600_000);
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: parsed.success ?? false,
          notes: parsed.notes || output,
          commitSha: parsed.commitSha || "",
          branchName: parsed.branchName || `feature/ticket-${ctx.id.slice(-6)}`,
          testsRan: parsed.testsRan ?? false,
          testsPassed: parsed.testsPassed ?? false,
          output: parsed.output || output,
        };
      }
      return {
        success: false,
        notes: output,
        commitSha: "",
        branchName: `feature/ticket-${ctx.id.slice(-6)}`,
        testsRan: false,
        testsPassed: false,
        output,
      };
    } catch (err) {
      return {
        success: false,
        notes: `OpenClaw Fehler: ${err instanceof Error ? err.message : String(err)}`,
        commitSha: "",
        branchName: `feature/ticket-${ctx.id.slice(-6)}`,
        testsRan: false,
        testsPassed: false,
        output: "",
      };
    }
  }

  async runQA(ctx: TicketContext): Promise<QAResult> {
    const prompt = `Du bist der QA AGENT. Führe Qualitätssicherung für das letzte Commit durch.

REPO-PFAD: ${ctx.repoPath}

TICKET:
- ID: ${ctx.id}
- Titel: ${ctx.title}
- Beschreibung: ${ctx.description}

DEINE AUFGABE:
1. Finde das letzte Commit für dieses Ticket (Branch: feature/ticket-${ctx.id.slice(-6)})
2. Lese die geänderten Dateien
3. Prüfe: Funktioniert der Code? Sind Tests ausreichend? Stimmt der Stil?
4. Führe existierende Tests aus
5. Review den Code quality

OUTPUT FORMAT (JSON):
{
  "result": "passed" | "failed",
  "notes": "Detaillierte QA-Analyse...",
  "issues": ["Issue 1", "Issue 2"],
  "testCoverage": 75,
  "score": 82
}

score ist ein Gesamtqualitäts-Score von 1-100 basierend auf: Korrektheit, Testabdeckung, Code-Stil, Vollständigkeit.`;

    try {
      const output = await openClawSession(prompt, ctx.repoPath, 300_000);
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          result: parsed.result || "failed",
          notes: parsed.notes || output,
          issues: parsed.issues || [],
          testCoverage: parsed.testCoverage || 0,
          score: parsed.score || 0,
        };
      }
      return { result: "failed", notes: output, issues: [], testCoverage: 0, score: 0 };
    } catch (err) {
      return {
        result: "failed",
        notes: `QA Agent Fehler: ${err instanceof Error ? err.message : String(err)}`,
        issues: [],
        testCoverage: 0,
        score: 0,
      };
    }
  }
}
