export type TicketId = string;

export interface TicketContext {
  id: TicketId;
  title: string;
  description: string;
  priority: string;
  repoUrl: string;
  repoPath: string; // local path to the repo
  currentBranch: string;
}

export interface FeasibilityResult {
  result: "approved" | "rejected" | "needs_work";
  notes: string;
  refinedPlan: string; // expanded/improved task description
  risks: string[];
  estimatedHours?: number;
}

export interface DevelopmentResult {
  success: boolean;
  notes: string;
  commitSha: string;
  branchName: string;
  testsRan: boolean;
  testsPassed: boolean;
  output: string; // stdout/stderr from execution
}

export interface QAResult {
  result: "passed" | "failed";
  notes: string;
  issues: string[];
  testCoverage: number; // 0-100
  score: number; // 1-100 overall quality score
}

export interface AgentCapability {
  name: string;
  canReadFiles: boolean;
  canWriteFiles: boolean;
  canExecuteCommands: boolean;
  canCommitToGit: boolean;
  canRunTests: boolean;
  model?: string;
}

export interface AgentAdapter {
  readonly id: string;
  readonly name: string;
  readonly capabilities: AgentCapability;

  /**
   * Stage 1: Assess feasibility of a ticket.
   * Reads repo code, evaluates the task, returns assessment.
   */
  assessFeasibility(ctx: TicketContext): Promise<FeasibilityResult>;

  /**
   * Stage 2: Develop the feature/fix.
   * Reads code, implements changes, commits to git.
   */
  develop(ctx: TicketContext, refinedPlan: string): Promise<DevelopmentResult>;

  /**
   * Stage 3: Run QA checks.
   */
  runQA(ctx: TicketContext): Promise<QAResult>;
}
