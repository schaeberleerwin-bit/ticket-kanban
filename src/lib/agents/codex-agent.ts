/**
 * OpenAI Codex CLI Agent Adapter
 *
 * Spawns `codex exec --dangerously-bypass-approvals-and-sandbox` as a subprocess.
 * Auth via OAuth (codex login) — no API key needed.
 */

import { AgentAdapter, TicketContext, FeasibilityResult, DevelopmentResult, QAResult } from "./types";
import { spawn } from "child_process";

function runCodex(prompt: string, cwd: string, timeoutMs = 600_000): Promise<string> {
  return new Promise((resolve, reject) => {
    // Prompt via stdin using `-` so long/complex prompts don't need shell escaping
    const child = spawn(
      "codex",
      ["exec", "--dangerously-bypass-approvals-and-sandbox", "-C", cwd, "-"],
      { timeout: timeoutMs, shell: true }
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.stdin.write(prompt);
    child.stdin.end();

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Codex exited ${code}\n${stderr}`));
      }
    });

    child.on("error", reject);
  });
}

export class CodexAgent implements AgentAdapter {
  readonly id = "codex";
  readonly name = "Codex";
  readonly capabilities = {
    name: "OpenAI Codex CLI",
    canReadFiles: true,
    canWriteFiles: true,
    canExecuteCommands: true,
    canCommitToGit: true,
    canRunTests: true,
    model: "codex-1",
  };

  async assessFeasibility(ctx: TicketContext): Promise<FeasibilityResult> {
    const prompt = `FEASIBILITY CHECK for ticket: ${ctx.title}

Context:
- Repo: ${ctx.repoUrl}
- Working directory: ${ctx.repoPath}
- Description: ${ctx.description}
- Priority: ${ctx.priority}

Tasks:
1. Explore the codebase to understand relevant files
2. Assess if this task is technically feasible
3. If description is vague - refine it into concrete steps
4. Identify risks and blockers
5. Estimate hours needed

Respond in JSON format only (no markdown):
{"result":"approved|rejected|needs_work","notes":"...","refinedPlan":"...","risiken":["..."],"estimatedHours":N}`;

    try {
      const output = await runCodex(prompt, ctx.repoPath, 300_000);
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
      return { result: "needs_work", notes: output, refinedPlan: ctx.description, risks: [] };
    } catch (err) {
      return {
        result: "needs_work",
        notes: `Codex Error: ${err instanceof Error ? err.message : String(err)}`,
        refinedPlan: ctx.description,
        risks: ["Codex CLI nicht verfügbar oder fehlgeschlagen"],
      };
    }
  }

  async develop(ctx: TicketContext, refinedPlan: string): Promise<DevelopmentResult> {
    const branchName = `feature/ticket-${ctx.id.slice(-6)}`;
    const prompt = `DEVELOPMENT TASK for ticket: ${ctx.title}

Working directory: ${ctx.repoPath}
Branch to create: ${branchName}

Description: ${ctx.description}
Refined Plan: ${refinedPlan}

Tasks:
1. Explore the codebase first
2. Create branch: git checkout -b ${branchName}
3. Implement the changes
4. Add/update tests
5. Run tests
6. Commit with message: "feat: ${ctx.title} [ticket-${ctx.id.slice(-6)}]"
7. Push: git push -u origin ${branchName}

Respond in JSON only (no markdown):
{"success":true,"notes":"...","commitSha":"...","branchName":"...","testsRan":true,"testsPassed":true,"output":"..."}`;

    try {
      const output = await runCodex(prompt, ctx.repoPath, 600_000);
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: parsed.success ?? false,
          notes: parsed.notes || output,
          commitSha: parsed.commitSha || "",
          branchName: parsed.branchName || branchName,
          testsRan: parsed.testsRan ?? false,
          testsPassed: parsed.testsPassed ?? false,
          output: parsed.output || output,
        };
      }
      return { success: false, notes: output, commitSha: "", branchName, testsRan: false, testsPassed: false, output };
    } catch (err) {
      return {
        success: false,
        notes: `Codex Error: ${err instanceof Error ? err.message : String(err)}`,
        commitSha: "",
        branchName,
        testsRan: false,
        testsPassed: false,
        output: "",
      };
    }
  }

  async runQA(ctx: TicketContext): Promise<QAResult> {
    const branchName = `feature/ticket-${ctx.id.slice(-6)}`;
    const prompt = `QA REVIEW for ticket: ${ctx.title}

Working directory: ${ctx.repoPath}
Branch to review: ${branchName}

Tasks:
1. Check out the branch: git checkout ${branchName}
2. Read changed files from last commit
3. Review: Does the code work? Are tests sufficient? Is style consistent?
4. Run existing test suite
5. Report quality issues

Respond in JSON only (no markdown):
{"result":"passed|failed","notes":"...","issues":["..."],"testCoverage":N,"score":N}

score is an overall quality score from 1-100 based on: correctness, test coverage, code style, completeness.`;

    try {
      const output = await runCodex(prompt, ctx.repoPath, 300_000);
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
        notes: `Codex Error: ${err instanceof Error ? err.message : String(err)}`,
        issues: [],
        testCoverage: 0,
        score: 0,
      };
    }
  }
}
