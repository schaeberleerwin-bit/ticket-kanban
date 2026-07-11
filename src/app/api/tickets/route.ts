import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createIssue, setupLabels } from "@/lib/github";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    include: { activities: { orderBy: { createdAt: "desc" }, take: 10 } },
  });

  return NextResponse.json(tickets);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    title,
    description = "",
    priority = "medium",
    status = "backlog",
    projectId = null,
    reporter = "user",
    labels = [],
    _fromGitHub = false,  // loop prevention flag
    githubIssueNumber = null,
    githubIssueUrl = "",
  } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const maxOrder = await prisma.ticket.aggregate({
    where: { status },
    _max: { order: true },
  });

  const ticket = await prisma.ticket.create({
    data: {
      title: title.trim(),
      description,
      priority,
      status,
      projectId,
      reporter,
      labels: JSON.stringify(labels),
      order: (maxOrder._max.order ?? -1) + 1,
      ...(githubIssueNumber !== null && { githubIssueNumber, githubIssueUrl }),
    },
    include: { activities: true },
  });

  await prisma.activity.create({
    data: {
      ticketId: ticket.id,
      type: "status_change",
      message: `Ticket erstellt in ${status}`,
    },
  });

  // Sync to GitHub unless this came from GitHub webhook
  if (!_fromGitHub && projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project?.githubRepo && process.env.GITHUB_TOKEN) {
      try {
        await setupLabels(project.githubRepo).catch(() => null);
        const issue = await createIssue(project.githubRepo, ticket.title, ticket.description, ticket.status, ticket.priority);
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { githubIssueNumber: issue.number, githubIssueUrl: issue.url },
        });
        (ticket as Record<string, unknown>).githubIssueNumber = issue.number;
        (ticket as Record<string, unknown>).githubIssueUrl = issue.url;
      } catch (e) {
        console.error("GitHub sync failed:", e);
      }
    }
  }

  return NextResponse.json(ticket, { status: 201 });
}
