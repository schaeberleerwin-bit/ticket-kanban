import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TicketStatus = "backlog" | "feasibility" | "progress" | "qa" | "done";
export type Priority = "low" | "medium" | "high" | "critical";
export type FeasibilityResult = "approved" | "rejected" | "needs_work" | "";
export type QAResult = "passed" | "failed" | "";

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
  order: number;
  feasibilityNotes: string;
  feasibilityResult: FeasibilityResult;
  feasibilityAgent: string;
  developmentNotes: string;
  developmentAgent: string;
  commitSha: string;
  branchName: string;
  qaNotes: string;
  qaResult: QAResult;
  qaScore: number;
  labels: string[];
  assignee: string;
  reporter: string;
  projectId: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  githubRepo?: string;
  webhookSecret?: string;
  githubIssueNumber?: number | null;
  githubIssueUrl?: string;
}

export interface AgentRunInfo {
  ticketId: string;
  stage: string;
  startedAt: number;
}

export interface AgentCompleteInfo {
  stage: string;
  startedAt: number;
  completedAt: number;
}

interface TicketStore {
  tickets: Ticket[];
  projects: Project[];
  activeProjectId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setActiveProject: (id: string) => void;
  fetchTickets: (projectId?: string) => Promise<void>;
  fetchProjects: () => Promise<void>;
  createTicket: (data: Partial<Ticket>) => Promise<Ticket>;
  updateTicket: (id: string, data: Partial<Ticket>) => Promise<void>;
  moveTicket: (id: string, status: TicketStatus) => Promise<void>;
  deleteTicket: (id: string) => Promise<void>;
  createProject: (data: Partial<Project>) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;

  // Agent state (persisted) — keyed by ticketId for multitasking
  runningAgents: Record<string, AgentRunInfo>;
  setRunningAgent: (ticketId: string, info: AgentRunInfo | null) => void;
  completedAgents: Record<string, AgentCompleteInfo>;
  markAgentComplete: (ticketId: string) => void;
  clearAgentComplete: (ticketId: string) => void;
}

export const useTicketStore = create<TicketStore>()(persist((set, get) => ({
  tickets: [],
  projects: [],
  activeProjectId: null,
  isLoading: false,
  error: null,
  runningAgents: {},
  completedAgents: {},

  setActiveProject: (id) => {
    set({ activeProjectId: id });
    get().fetchTickets(id);
  },

  fetchTickets: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (projectId) params.set("projectId", projectId);
      const res = await fetch(`/api/tickets?${params}`);
      if (!res.ok) throw new Error("Failed to fetch tickets");
      const tickets = await res.json();
      set({ tickets, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Unknown error", isLoading: false });
    }
  },

  fetchProjects: async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      const projects = await res.json();
      set({ projects });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  },

  createTicket: async (data) => {
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create ticket");
    const ticket = await res.json();
    set((state) => ({ tickets: [...state.tickets, ticket] }));
    return ticket;
  },

  updateTicket: async (id, data) => {
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update ticket");
    const updated = await res.json();
    set((state) => ({
      tickets: state.tickets.map((t) => (t.id === id ? updated : t)),
    }));
  },

  moveTicket: async (id, status) => {
    set((state) => {
      const completedAgents = { ...state.completedAgents };
      delete completedAgents[id];
      return {
        tickets: state.tickets.map((t) => (t.id === id ? { ...t, status } : t)),
        completedAgents,
      };
    });
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      await get().fetchTickets(get().activeProjectId || undefined);
    }
  },

  deleteTicket: async (id) => {
    const res = await fetch(`/api/tickets/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Löschen fehlgeschlagen");
    set((state) => {
      const completedAgents = { ...state.completedAgents };
      const runningAgents = { ...state.runningAgents };
      delete completedAgents[id];
      delete runningAgents[id];
      return { tickets: state.tickets.filter((t) => t.id !== id), completedAgents, runningAgents };
    });
  },

  createProject: async (data) => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create project");
    const project = await res.json();
    set((state) => ({ projects: [...state.projects, project] }));
    return project;
  },

  deleteProject: async (id) => {
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Projekt löschen fehlgeschlagen");
    set((state) => {
      const wasActive = state.activeProjectId === id;
      return {
        projects: state.projects.filter((p) => p.id !== id),
        activeProjectId: wasActive ? null : state.activeProjectId,
        tickets: wasActive ? [] : state.tickets,
      };
    });
  },

  setRunningAgent: (ticketId, info) => {
    set((state) => {
      const runningAgents = { ...state.runningAgents };
      if (info) {
        runningAgents[ticketId] = info;
      } else {
        delete runningAgents[ticketId];
      }
      return { runningAgents };
    });
  },

  markAgentComplete: (ticketId) => {
    set((state) => {
      const running = state.runningAgents[ticketId];
      const runningAgents = { ...state.runningAgents };
      delete runningAgents[ticketId];
      return {
        runningAgents,
        completedAgents: {
          ...state.completedAgents,
          [ticketId]: {
            stage: running?.stage ?? "unknown",
            startedAt: running?.startedAt ?? Date.now(),
            completedAt: Date.now(),
          },
        },
      };
    });
  },

  clearAgentComplete: (ticketId) => {
    set((state) => {
      const completedAgents = { ...state.completedAgents };
      delete completedAgents[ticketId];
      return { completedAgents };
    });
  },
}), {
  name: "ticketflow-store",
  partialize: (state) => ({
    runningAgents: state.runningAgents,
    completedAgents: state.completedAgents,
  }),
}));
