import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { tickets: true } } },
  });
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description = "", repoUrl = "", githubRepo = "", webhookSecret = "" } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: { name: name.trim(), description, repoUrl, githubRepo, webhookSecret },
  });

  // Create default agent configs for this project
  await prisma.agentConfig.createMany({
    data: [
      { name: "openclaw", displayName: "OpenClaw", projectId: project.id, enabled: true },
      { name: "claude-code", displayName: "Claude Code", projectId: project.id, enabled: false },
    ],
  });

  return NextResponse.json(project, { status: 201 });
}
