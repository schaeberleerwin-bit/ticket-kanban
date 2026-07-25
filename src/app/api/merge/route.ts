import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { execFileSync } from "child_process";

export async function POST(req: NextRequest) {
  const { projectId } = await req.json();
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const repoPath = project.repoPath;
  if (!repoPath) return NextResponse.json({ error: "Kein repoPath für dieses Projekt konfiguriert" }, { status: 400 });

  const doneTickets = await prisma.ticket.findMany({
    where: { projectId, status: "done", NOT: { branchName: "" } },
    select: { id: true, title: true, branchName: true },
  });

  const results: { branch: string; success: boolean; output: string }[] = [];

  let baseBranch = "main";
  try {
    execFileSync("git", ["checkout", "main"], { cwd: repoPath, stdio: "pipe" });
  } catch {
    try {
      execFileSync("git", ["checkout", "master"], { cwd: repoPath, stdio: "pipe" });
      baseBranch = "master";
    } catch (err) {
      return NextResponse.json({ error: `Konnte nicht auf main/master wechseln: ${err}` }, { status: 500 });
    }
  }

  for (const ticket of doneTickets) {
    try {
      const output = execFileSync(
        "git",
        ["merge", "--no-ff", ticket.branchName, "-m", `merge: ${ticket.title}`],
        { cwd: repoPath, stdio: "pipe" }
      ).toString();
      results.push({ branch: ticket.branchName, success: true, output });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ branch: ticket.branchName, success: false, output: msg });
    }
  }

  let pushError: string | null = null;
  try {
    execFileSync("git", ["push", "origin", baseBranch], { cwd: repoPath, stdio: "pipe" });
  } catch (err: unknown) {
    // Push optional – kein Hard-Fail wenn kein Remote, aber Fehler wird zurückgemeldet
    pushError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({ merged: results.filter((r) => r.success).length, results, baseBranch, pushError });
}
