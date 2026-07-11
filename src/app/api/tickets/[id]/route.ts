import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateIssue, setIssueLabels, closeIssue, reopenIssue } from "@/lib/github";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { activities: { orderBy: { createdAt: "desc" }, take: 50 } },
  });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(ticket);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const { status: newStatus, _fromGitHub = false, ...rest } = body;

  const existing = await prisma.ticket.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updateData: Record<string, unknown> = { ...rest };
  const statusChanged = newStatus && newStatus !== existing.status;

  if (statusChanged) {
    updateData.status = newStatus;

    await prisma.activity.create({
      data: {
        ticketId: id,
        type: "status_change",
        message: `Status geändert: ${existing.status} → ${newStatus}`,
      },
    });

    if (newStatus === "done" && existing.status === "qa") {
      await prisma.activity.create({
        data: { ticketId: id, type: "status_change", message: "Ticket abgeschlossen ✓" },
      });
    }
  }

  if (Array.isArray(rest.labels)) {
    updateData.labels = JSON.stringify(rest.labels);
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data: updateData,
    include: { activities: { orderBy: { createdAt: "desc" }, take: 20 } },
  });

  // Sync to GitHub
  if (!_fromGitHub && existing.githubIssueNumber && existing.projectId) {
    const project = await prisma.project.findUnique({ where: { id: existing.projectId } });
    if (project?.githubRepo && process.env.GITHUB_TOKEN) {
      const repo = project.githubRepo;
      const num = existing.githubIssueNumber;
      try {
        const titleChanged = rest.title && rest.title !== existing.title;
        const descChanged = rest.description !== undefined && rest.description !== existing.description;

        if (titleChanged || descChanged) {
          await updateIssue(repo, num, {
            ...(titleChanged && { title: rest.title }),
            ...(descChanged && { body: rest.description }),
          });
        }

        if (statusChanged) {
          const finalStatus = newStatus as string;
          const finalPriority = (rest.priority as string) || existing.priority;
          if (finalStatus === "done") {
            await closeIssue(repo, num);
          } else {
            if (existing.status === "done") await reopenIssue(repo, num);
            await setIssueLabels(repo, num, finalStatus, finalPriority);
          }
        } else if (rest.priority && rest.priority !== existing.priority) {
          await setIssueLabels(repo, num, existing.status, rest.priority);
        }
      } catch (e) {
        console.error("GitHub sync failed:", e);
      }
    }
  }

  return NextResponse.json(ticket);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.activity.deleteMany({ where: { ticketId: id } });
    await prisma.ticket.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
