const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const API = "https://api.github.com";

// Kanban status → GitHub label
export const STATUS_LABEL: Record<string, string> = {
  backlog:     "kanban:backlog",
  feasibility: "kanban:feasibility",
  progress:    "kanban:progress",
  qa:          "kanban:qa",
  done:        "kanban:done",
};

export const PRIORITY_LABEL: Record<string, string> = {
  low:      "priority:low",
  medium:   "priority:medium",
  high:     "priority:high",
  critical: "priority:critical",
};

const LABEL_TO_STATUS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_LABEL).map(([s, l]) => [l, s])
);
const LABEL_TO_PRIORITY: Record<string, string> = Object.fromEntries(
  Object.entries(PRIORITY_LABEL).map(([p, l]) => [l, p])
);

export function labelToStatus(label: string) { return LABEL_TO_STATUS[label]; }
export function labelToPriority(label: string) { return LABEL_TO_PRIORITY[label]; }

function headers() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function gh(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: headers(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub ${method} ${path} → ${res.status}: ${err}`);
  }
  return res.status === 204 ? null : res.json();
}

export async function setupLabels(repo: string) {
  const existing: Array<{ name: string }> = await gh("GET", `/repos/${repo}/labels?per_page=100`);
  const existingNames = new Set(existing.map((l) => l.name));

  const needed = [
    { name: "kanban:backlog",     color: "c0c0c0", description: "TicketFlow: Backlog" },
    { name: "kanban:feasibility", color: "0075ca", description: "TicketFlow: Feasibility" },
    { name: "kanban:progress",    color: "e4a010", description: "TicketFlow: In Progress" },
    { name: "kanban:qa",          color: "d93f0b", description: "TicketFlow: QA" },
    { name: "kanban:done",        color: "0e8a16", description: "TicketFlow: Done" },
    { name: "priority:low",       color: "c0c0c0", description: "TicketFlow: Low priority" },
    { name: "priority:medium",    color: "0075ca", description: "TicketFlow: Medium priority" },
    { name: "priority:high",      color: "e4a010", description: "TicketFlow: High priority" },
    { name: "priority:critical",  color: "b60205", description: "TicketFlow: Critical priority" },
  ];

  for (const label of needed) {
    if (!existingNames.has(label.name)) {
      await gh("POST", `/repos/${repo}/labels`, label).catch(() => null);
    }
  }
}

export async function createIssue(
  repo: string,
  title: string,
  body: string,
  status: string,
  priority: string
) {
  const labels = [STATUS_LABEL[status], PRIORITY_LABEL[priority]].filter(Boolean);
  const issue: { number: number; html_url: string } = await gh("POST", `/repos/${repo}/issues`, {
    title,
    body,
    labels,
  });
  return { number: issue.number, url: issue.html_url };
}

export async function updateIssue(
  repo: string,
  number: number,
  patch: { title?: string; body?: string; state?: "open" | "closed" }
) {
  await gh("PATCH", `/repos/${repo}/issues/${number}`, patch);
}

export async function setIssueLabels(
  repo: string,
  number: number,
  status: string,
  priority: string
) {
  // Fetch current labels, keep non-kanban/non-priority ones
  const current: Array<{ name: string }> = await gh("GET", `/repos/${repo}/issues/${number}/labels`);
  const keep = current
    .map((l) => l.name)
    .filter((n) => !n.startsWith("kanban:") && !n.startsWith("priority:"));
  const next = [...keep, STATUS_LABEL[status], PRIORITY_LABEL[priority]].filter(Boolean);
  await gh("PUT", `/repos/${repo}/issues/${number}/labels`, { labels: next });
}

export async function closeIssue(repo: string, number: number) {
  await gh("PATCH", `/repos/${repo}/issues/${number}`, { state: "closed", state_reason: "completed" });
}

export async function reopenIssue(repo: string, number: number) {
  await gh("PATCH", `/repos/${repo}/issues/${number}`, { state: "open" });
}

// HMAC-SHA256 signature verification for webhooks
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!signature.startsWith("sha256=")) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256=${hex}` === signature;
}
