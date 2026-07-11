import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { agentRegistry } from "@/lib/agents";
import type { TicketContext } from "@/lib/agents/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ticketId, stage, agentId } = body;

  if (!ticketId || !stage) {
    return NextResponse.json({ error: "ticketId and stage are required" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const project = ticket.projectId
    ? await prisma.project.findUnique({ where: { id: ticket.projectId } })
    : null;

  const ctx: TicketContext = {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    priority: ticket.priority,
    repoUrl: project?.repoUrl || "",
    repoPath: project?.repoPath || process.env.REPO_PATH || ".",
    currentBranch: ticket.branchName || "main",
  };

  const agent = agentRegistry.get(agentId || "openclaw");
  if (!agent) {
    return NextResponse.json({ error: `Agent ${agentId} not found` }, { status: 404 });
  }

  // Activity logging helper
  const logActivity = async (type: string, message: string, metadata: Record<string, unknown> = {}) => {
    await prisma.activity.create({
      data: {
        ticketId,
        type,
        message,
        metadata: JSON.stringify(metadata),
      },
    });
  };

  try {
    let result: unknown;
    let newStatus: string | null = null;

    if (stage === "feasibility") {
      await logActivity("agent_action", `${agent.name}: Starte Feasibility-Check...`);
      const res = await agent.assessFeasibility(ctx);
      result = res;

      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          feasibilityNotes: res.notes,
          feasibilityResult: res.result,
          feasibilityAgent: agent.id,
          ...(res.refinedPlan && { description: res.refinedPlan }),
        },
      });

      await logActivity("agent_action", `${agent.name} Feasibility: ${res.result}`, { result: res.result, risks: res.risks });
      // User moves from feasibility → progress manually

    } else if (stage === "develop") {
      await logActivity("agent_action", `${agent.name}: Starte Entwicklung...`);
      const res = await agent.develop(ctx, ticket.description);
      result = res;

      newStatus = res.success ? "qa" : "progress"; // stay in progress if failed

      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          developmentNotes: res.notes,
          developmentAgent: agent.id,
          commitSha: res.commitSha,
          branchName: res.branchName,
          ...(newStatus && { status: newStatus }),
        },
      });

      await logActivity("commit", `Commit ${res.commitSha?.slice(0, 7)} on ${res.branchName}`, {
        commitSha: res.commitSha,
        branchName: res.branchName,
        success: res.success,
      });

    } else if (stage === "qa") {
      await logActivity("agent_action", `${agent.name}: Starte QA...`);
      const res = await agent.runQA(ctx);
      result = res;

      newStatus = res.result === "passed" ? "done" : "qa";

      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          qaNotes: res.notes,
          qaResult: res.result,
          qaScore: res.score,
          ...(newStatus && { status: newStatus }),
        },
      });

      await logActivity("agent_action", `QA: ${res.result} (Score: ${res.score}/100)`, { issues: res.issues, score: res.score });

    } else {
      return NextResponse.json({ error: `Unknown stage: ${stage}` }, { status: 400 });
    }

    const updatedTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { activities: { orderBy: { createdAt: "desc" }, take: 20 } },
    });

    return NextResponse.json({ result, ticket: updatedTicket, newStatus });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await logActivity("agent_action", `Fehler: ${errorMsg}`, { error: errorMsg });
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
