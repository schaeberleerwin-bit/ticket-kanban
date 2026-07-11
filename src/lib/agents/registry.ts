import { AgentAdapter } from "./types";

export class AgentRegistry {
  private agents = new Map<string, AgentAdapter>();

  register(agent: AgentAdapter) {
    this.agents.set(agent.id, agent);
  }

  get(id: string): AgentAdapter | undefined {
    return this.agents.get(id);
  }

  list(): AgentAdapter[] {
    return Array.from(this.agents.values());
  }

  listIds(): string[] {
    return Array.from(this.agents.keys());
  }
}

// Singleton registry
export const agentRegistry = new AgentRegistry();
