import type { ToolRegistry } from "../tools/registry";
import type { AgentConfig } from "../types";
import {
  displayApprovalPrompt,
  displayApprovalResult,
} from "../utils/approval-display";
import { writeAuditEntry } from "../utils/audit-log";
import { parseModelJson } from "../utils/parser";
import { ask, confirm } from "../utils/prompt";
import { FinancialAgent } from "./financial.agent";

const AUTO_APPROVE_TOOLS = new Set<string>([
  // Add tool names here that you fully trust to run without asking
  // e.g. "calculate_dca", "calculate_compound"
  // Leave empty to prompt for every tool
]);

export class SupervisedFinancialAgent extends FinancialAgent {
  private callIndex = 0;
  private totalCallsThisIteration = 0;

  constructor(registry: ToolRegistry, config: Partial<AgentConfig> = {}) {
    super(registry, config);
  }

  override async run(query: string) {
    this.callIndex = 0;
    return super.run(query);
  }

  protected override async requestApproval(
    toolName: string,
    rawArgs: string,
  ): Promise<boolean> {
    this.callIndex++;

    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs = parseModelJson<Record<string, unknown>>(rawArgs);
    } catch {
      parsedArgs = { raw: rawArgs };
    }

    if (AUTO_APPROVE_TOOLS.has(toolName)) {
      console.log(`\n⚡ Auto-approved: ${toolName}`);
      writeAuditEntry({
        timestamp: new Date().toISOString(),
        toolName,
        arguments: parsedArgs,
        decision: "approved",
        durationMs: 0,
      });
      return true;
    }

    displayApprovalPrompt(toolName, parsedArgs, this.callIndex, this.callIndex);

    const startTime = Date.now();

    while (true) {
      const answer = await ask(
        "  Allow this tool call? " +
          "\x1b[32m[y]\x1b[0m approve  " +
          "\x1b[31m[n]\x1b[0m reject  " +
          "\x1b[33m[e]\x1b[0m edit args  " +
          "\x1b[36m[?]\x1b[0m explain  " +
          "> ",
      );

      const durationMs = Date.now() - startTime;

      switch (answer.toLowerCase()) {
        case "y":
        case "yes": {
          displayApprovalResult("approved", toolName);
          writeAuditEntry({
            timestamp: new Date().toISOString(),
            toolName,
            arguments: parsedArgs,
            decision: "approved",
            durationMs,
          });
          this.totalCallsThisIteration++;
          return true;
        }

        case "n":
        case "no": {
          displayApprovalResult("rejected", toolName);
          writeAuditEntry({
            timestamp: new Date().toISOString(),
            toolName,
            arguments: parsedArgs,
            decision: "rejected",
            durationMs,
          });
          return false;
        }

        case "e":
        case "edit": {
          console.log("\n  Current args (edit the JSON below):");
          console.log(
            "  " + JSON.stringify(parsedArgs, null, 2).split("\n").join("\n  "),
          );

          const edited = await ask(
            "\n  Paste edited JSON (or press Enter to cancel): ",
          );

          if (!edited) {
            console.log("  Edit cancelled — showing prompt again.\n");
            continue;
          }

          try {
            const editedArgs = parseModelJson<Record<string, unknown>>(edited);

            // Mutate rawArgs in the registry call by passing editedArgs back.
            // We do this by overwriting the rawArgs reference via a closure trick:
            // Re-serialize edited args so ToolRegistry.execute() receives them.
            const editedRaw = JSON.stringify(editedArgs);

            console.log("\n  Updated args:");
            for (const [k, v] of Object.entries(editedArgs)) {
              console.log(`    ${k}: ${JSON.stringify(v)}`);
            }

            const confirmed = await confirm(
              "\n  Execute with these edited args?",
            );
            if (!confirmed) {
              console.log("  Reverting to original args.\n");
              continue;
            }

            displayApprovalResult("edited", toolName);
            writeAuditEntry({
              timestamp: new Date().toISOString(),
              toolName,
              arguments: parsedArgs,
              decision: "edited",
              editedArgs,
              durationMs: Date.now() - startTime,
            });

            this.pendingEditedArgs = editedRaw;
            return true;
          } catch {
            console.log("  Invalid JSON — try again.\n");
            continue;
          }
        }

        default: {
          console.log("  Type y, n, e, or ? and press Enter.\n");
          continue;
        }
      }
    }
  }

  protected override consumePendingEdit(): string | null {
    const edited = this.pendingEditedArgs;
    this.pendingEditedArgs = null;
    return edited;
  }

  public pendingEditedArgs: string | null = null;
}
