/**
 * Claude Code Agent Adapter
 *
 * Spawns Claude Code CLI as a subprocess with a task prompt.
 * Requires: npx claude-code (installed via @anthropic-ai/claude-code)
 */

import { AgentAdapter, TicketContext, FeasibilityResult, DevelopmentResult, QAResult } from "./types";
import { spawn } from "child_process";

function runClaudeCode(prompt: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["--print", "--dangerously-skip-permissions", "--output-format", "text"], {
      cwd,
      timeout: 600000,
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Claude Code exited with code ${code}\nSTDERR: ${stderr}`));
      }
    });

    child.on("error", reject);

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

export class ClaudeCodeAgent implements AgentAdapter {
  readonly id = "claude-code";
  readonly name = "Claude Code";
  readonly capabilities = {
    name: "Claude Code CLI",
    canReadFiles: true,
    canWriteFiles: true,
    canExecuteCommands: true,
    canCommitToGit: true,
    canRunTests: true,
    model: "claude-sonnet-4-6",
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

Respond in JSON format:
{"result":"approved|rejected|needs_work","notes":"...","refinedPlan":"...","risiken":["..."],"estimatedHours":N}`;

    try {
      const output = await runClaudeCode(prompt, ctx.repoPath);
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
        notes: `Claude Code Error: ${err instanceof Error ? err.message : String(err)}`,
        refinedPlan: ctx.description,
        risks: ["Claude Code not available or failed"],
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

Respond in JSON:
{"success":true/false,"notes":"...","commitSha":"...","branchName":"...","testsRan":true/false,"testsPassed":true/false,"output":"..."}`;

    try {
      const output = await runClaudeCode(prompt, ctx.repoPath);
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
        notes: `Claude Code Error: ${err instanceof Error ? err.message : String(err)}`,
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

Respond in JSON:
{"result":"passed|failed","notes":"...","issues":["..."],"testCoverage":N,"score":N}

score is an overall quality score from 1-100 based on: correctness, test coverage, code style, completeness.`;

    try {
      const output = await runClaudeCode(prompt, ctx.repoPath);
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
        notes: `Claude Code Error: ${err instanceof Error ? err.message : String(err)}`,
        issues: [],
        testCoverage: 0,
        score: 0,
      };
    }
  }
}
