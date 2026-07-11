import { agentRegistry } from "./registry";
import { OpenClawAgent } from "./openclaw-agent";
import { ClaudeCodeAgent } from "./claude-code-agent";
import { CodexAgent } from "./codex-agent";

// Register all available agents
agentRegistry.register(new OpenClawAgent());
agentRegistry.register(new ClaudeCodeAgent());
agentRegistry.register(new CodexAgent());

export { agentRegistry } from "./registry";
export type { AgentAdapter, TicketContext, FeasibilityResult, DevelopmentResult, QAResult } from "./types";
