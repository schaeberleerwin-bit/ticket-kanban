import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, labelToStatus, labelToPriority, STATUS_LABEL, PRIORITY_LABEL } from "@/lib/github";

export async function POST(req: NextRequest) {
  const event = req.headers.get("x-github-event");
  const signature = req.headers.get("x-hub-signature-256") || "";
  const payload = await req.text();

  // Find project by repo full_name from payload
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const repo = (data.repository as Record<string, unknown>)?.full_name as string;
  if (!repo) return NextResponse.json({ ok: true }); // not an issue event

  // Find matching project
  const project = await prisma.project.findFirst({ where: { githubRepo: repo } });
  if (!project) return NextResponse.json({ ok: true }); // no project configured for this repo

  // Verify signature if secret is set
  if (project.webhookSecret) {
    const valid = await verifyWebhookSignature(payload, signature, project.webhookSecret);
    if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event !== "issues") return NextResponse.json({ ok: true });

  const action = data.action as string;
  const issue = data.issue as Record<string, unknown>;
  const issueNumber = issue.number as number;
  const issueLabels: Array<{ name: string }> = (issue.labels as Array<{ name: string }>) || [];

  // Extract kanban status and priority from labels
  let status = "backlog";
  let priority = "medium";
  for (const { name } of issueLabels) {
    const s = labelToStatus(name);
    if (s) status = s;
    const p = labelToPriority(name);
    if (p) priority = p;
  }

  const title = issue.title as string;
  const description = (issue.body as string) || "";
  const issueUrl = issue.html_url as string;

  // Find existing ticket linked to this issue
  const existing = await prisma.ticket.findFirst({
    where: { projectId: project.id, githubIssueNumber: issueNumber },
  });

  if (action === "opened") {
    if (existing) return NextResponse.json({ ok: true }); // already linked

    const maxOrder = await prisma.ticket.aggregate({
      where: { status },
      _max: { order: true },
    });

    await prisma.ticket.create({
      data: {
        title,
        description,
        priority,
        status,
        projectId: project.id,
        reporter: "github",
        labels: JSON.stringify(issueLabels.map((l) => l.name).filter((n) => !n.startsWith("kanban:") && !n.startsWith("priority:"))),
        order: (maxOrder._max.order ?? -1) + 1,
        githubIssueNumber: issueNumber,
        githubIssueUrl: issueUrl,
      },
    });

    return NextResponse.json({ ok: true, created: true });
  }

  if (!existing) return NextResponse.json({ ok: true });

  if (action === "edited") {
    await prisma.ticket.update({
      where: { id: existing.id },
      data: {
        ...(issue.title !== existing.title && { title }),
        ...(description !== existing.description && { description }),
      },
    });
  } else if (action === "closed") {
    if (existing.status !== "done") {
      await prisma.ticket.update({ where: { id: existing.id }, data: { status: "done" } });
      await prisma.activity.create({
        data: { ticketId: existing.id, type: "status_change", message: "GitHub Issue geschlossen → Done" },
      });
    }
  } else if (action === "reopened") {
    await prisma.ticket.update({ where: { id: existing.id }, data: { status: "backlog" } });
    await prisma.activity.create({
      data: { ticketId: existing.id, type: "status_change", message: "GitHub Issue wiedereröffnet → Backlog" },
    });
  } else if (action === "labeled" || action === "unlabeled") {
    const updateData: Record<string, string> = {};
    if (status !== existing.status) updateData.status = status;
    if (priority !== existing.priority) updateData.priority = priority;
    if (Object.keys(updateData).length) {
      await prisma.ticket.update({ where: { id: existing.id }, data: updateData });
      await prisma.activity.create({
        data: {
          ticketId: existing.id,
          type: "status_change",
          message: `GitHub Label-Sync: ${Object.entries(updateData).map(([k, v]) => `${k}→${v}`).join(", ")}`,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
