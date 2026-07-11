import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spawn } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

function runAgent(agentId: string, prompt: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let cmd: string;
    let args: string[];

    if (agentId === "claude-code") {
      cmd = "claude";
      args = ["--print", "--dangerously-skip-permissions", "--output-format", "text"];
    } else if (agentId === "codex") {
      cmd = "codex";
      args = ["exec", "--dangerously-bypass-approvals-and-sandbox", "-C", cwd, "-"];
    } else {
      const model = process.env.OPENCLAW_MODEL || "minimax-portal/MiniMax-M2.7";
      cmd = "openclaw";
      args = ["agent", "--local", "--json", "--model", model, "--message", prompt];
    }

    const child = spawn(cmd, args, { cwd, timeout: 300_000, shell: true });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    if (agentId === "claude-code" || agentId === "codex") {
      child.stdin.write(prompt);
      child.stdin.end();
    }

    child.on("close", (code) => {
      if (code === 0) {
        if (agentId !== "claude-code") {
          try {
            const parsed = JSON.parse(stdout);
            resolve(parsed.result || parsed.output || parsed.message || stdout);
            return;
          } catch { /* fallthrough */ }
        }
        resolve(stdout);
      } else {
        reject(new Error(`Agent exited ${code}\n${stderr}`));
      }
    });
    child.on("error", reject);
  });
}

function readProjectContext(repoPath: string): string {
  const snippets: string[] = [];

  const candidates = ["README.md", "readme.md", "package.json", "pyproject.toml", "Cargo.toml", "go.mod"];
  for (const file of candidates) {
    const p = join(repoPath, file);
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, "utf-8").slice(0, 2000);
        snippets.push(`=== ${file} ===\n${content}`);
      } catch { /* skip */ }
    }
  }

  return snippets.join("\n\n") || "Kein Kontext-Datei gefunden.";
}

// Server-seitiger Job-State: überlebt Page-Reloads
const jobs: Record<string, { running: boolean; error?: string }> = {};

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ running: false });
  return NextResponse.json(jobs[projectId] ?? { running: false });
}

export async function POST(req: NextRequest) {
  const { projectId, agentId = "openclaw" } = await req.json();

  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  if (jobs[projectId]?.running) return NextResponse.json({ error: "Läuft bereits" }, { status: 409 });

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const existingTickets = await prisma.ticket.findMany({
    where: { projectId },
    select: { title: true, status: true },
  });

  const repoPath = project.repoPath || process.env.REPO_PATH || ".";
  const context = readProjectContext(repoPath);

  const existingList = existingTickets.length
    ? existingTickets.map((t) => `- [${t.status}] ${t.title}`).join("\n")
    : "Noch keine Tickets vorhanden.";

  const prompt = `Du bist ein erfahrener Software-Projektmanager und Entwickler.
Analysiere dieses Projekt und erstelle sinnvolle Backlog-Tickets.

PROJEKT: ${project.name}
BESCHREIBUNG: ${project.description || "Keine Beschreibung"}
REPO-URL: ${project.repoUrl || "Kein Remote"}
REPO-PFAD: ${repoPath}

PROJEKT-KONTEXT:
${context}

BEREITS VORHANDENE TICKETS:
${existingList}

DEINE AUFGABE:
1. Verstehe was das Projekt macht und welche Features/Fixes sinnvoll wären
2. Erstelle 5-8 konkrete, umsetzbare Backlog-Tickets
3. Keine Duplikate zu bereits vorhandenen Tickets
4. Tickets sollen spezifisch, klein genug für einen Sprint, und klar beschrieben sein

ANTWORTE NUR mit gültigem JSON (kein Markdown, kein Text davor oder danach):
{
  "tickets": [
    {
      "title": "Kurzer, prägnanter Titel",
      "description": "Detaillierte Beschreibung was zu tun ist, warum und wie",
      "priority": "low" | "medium" | "high" | "critical"
    }
  ]
}`;

  jobs[projectId] = { running: true };

  // Fire-and-forget: läuft weiter auch wenn Client die Seite neu lädt
  (async () => {
    try {
      const output = await runAgent(agentId, prompt, repoPath);
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Kein gültiges JSON vom Agent");

      const parsed = JSON.parse(jsonMatch[0]);
      const suggestions: Array<{ title: string; description: string; priority: string }> = parsed.tickets || [];
      if (!suggestions.length) throw new Error("Agent hat keine Tickets zurückgegeben");

      await prisma.$transaction(
        suggestions.map((t) =>
          prisma.ticket.create({
            data: {
              title: t.title,
              description: t.description,
              priority: (["low", "medium", "high", "critical"].includes(t.priority) ? t.priority : "medium") as "low" | "medium" | "high" | "critical",
              status: "backlog",
              projectId,
              reporter: agentId,
            },
          })
        )
      );
      jobs[projectId] = { running: false };
    } catch (err) {
      jobs[projectId] = { running: false, error: err instanceof Error ? err.message : String(err) };
    }
  })();

  return NextResponse.json({ started: true });
}
