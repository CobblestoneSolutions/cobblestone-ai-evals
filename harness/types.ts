/**
 * One test-case format shared by all three projects.
 * Cases live in <project>/evals/cases.jsonl, one JSON object per line.
 */
export interface EvalCase<I = unknown, E = Record<string, unknown>> {
  /** Stable id, e.g. "sup-014". Never reuse an id for a different question. */
  id: string;
  /** Category used for per-type scores, e.g. "lookup", "not-in-docs", "adversarial". */
  type: string;
  /** What the system under test receives. */
  input: I;
  /** What a correct output looks like. Each project's checks decide how to read it. */
  expect: E;
  tags?: string[];
  /** Why this case exists — shown next to failures in the report. */
  note?: string;
}

/** What a project returns for one case. */
export interface SystemOutput {
  /** The user-visible answer. */
  text: string;
  /** Structured data (e.g. an extracted receipt). */
  data?: unknown;
  /** Section ids / sources the answer cites. */
  citations?: string[];
  /** Tools or internal actions the system took, in order. */
  actions?: string[];
  /** Anything else worth keeping in the record (retrieved chunks, self-check verdicts, …). */
  meta?: Record<string, unknown>;
}

export interface CheckResult {
  name: string;
  pass: boolean;
  /** Shown in the report when the check fails. */
  detail?: string;
  /** A check marked critical fails the whole case on its own. Default: true. */
  critical?: boolean;
}

export type Check<C extends EvalCase = EvalCase> = (
  c: C,
  out: SystemOutput,
  ctx: CheckContext,
) => CheckOutcome | Promise<CheckOutcome>;
/** null = check does not apply to this case; an array = several named results (e.g. one per field). */
export type CheckOutcome = CheckResult | CheckResult[] | null;

export interface CompleteRequest {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string | ContentBlock[] }[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string } };

export interface CompleteResponse {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cached?: boolean;
}

export interface LLMProvider {
  readonly name: string;
  complete(req: CompleteRequest): Promise<CompleteResponse>;
}

export interface RunContext {
  /** Model client for the system under test. */
  llm: LLMProvider;
  /** Prompt body (frontmatter stripped) of the version being evaluated. */
  prompt: string;
  promptVersion: string;
  projectDir: string;
}

export interface CheckContext {
  /** Model client for LLM-graded checks (the judge). */
  judge: LLMProvider;
}

/** A project plugs into the harness by default-exporting one of these from <project>/project.ts. */
export interface Project<C extends EvalCase = EvalCase> {
  name: string;
  /** Produce the system's output for one case. */
  run(c: C, ctx: RunContext): Promise<SystemOutput>;
  /** Checks applied to every case. A case passes when every critical check passes. */
  checks: Check<C>[];
  /** Optional one-time setup before a run (e.g. build a search index). */
  prepare?(ctx: Omit<RunContext, 'llm'>): Promise<void>;
  /**
   * Offline stand-in for the model, used with `--provider mock`.
   * Lets the pipeline and checks be tested without an API key or spend.
   */
  mock?(req: CompleteRequest): string;
}

export interface CaseResult {
  id: string;
  type: string;
  input: unknown;
  expect: unknown;
  note?: string;
  output?: SystemOutput;
  error?: string;
  checks: CheckResult[];
  pass: boolean;
  ms: number;
}

export interface RunRecord {
  project: string;
  promptVersion: string;
  promptSha256: string;
  model: string;
  judgeModel: string;
  provider: string;
  startedAt: string;
  finishedAt: string;
  gitCommit?: string;
  totals: { cases: number; passed: number; failed: number; errors: number; passRate: number };
  byType: Record<string, { cases: number; passed: number; passRate: number }>;
  /** Pass rate of each named check across cases where it ran. */
  byCheck: Record<string, { ran: number; passed: number; passRate: number }>;
  usage: { inputTokens: number; outputTokens: number };
  results: CaseResult[];
}

/** Frontmatter at the top of prompts/<version>.md — the change log lives with the prompt. */
export interface PromptMeta {
  version: string;
  /** One line: what changed from the previous version. */
  change?: string;
  /** Case ids this change is meant to fix. The report verifies each claim. */
  fixes?: string[];
}
