import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";

export type ApprovalDecision = "approved" | "rejected" | "edited";

export interface AuditEntry {
  timestamp: string;
  toolName: string;
  arguments: Record<string, unknown>;
  decision: ApprovalDecision;
  editedArgs?: Record<string, unknown>;
  durationMs: number; // How long the human took to decide
}

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "audit.jsonl");

let dirEnsured = false;
function ensureDir(): void {
  if (!dirEnsured) {
    mkdirSync(LOG_DIR, { recursive: true });
    dirEnsured = true;
  }
}

export function writeAuditEntry(entry: AuditEntry): void {
  try {
    ensureDir();
    appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");
  } catch (err) {
    console.warn(`Failed to write audit log: ${(err as Error).message}`);
  }
}

export function getLogPath(): string {
  return LOG_FILE;
}
