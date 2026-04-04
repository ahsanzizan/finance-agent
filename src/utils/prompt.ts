import * as readline from "readline";

let rl: readline.Interface | null = null;

function getReadline(): readline.Interface {
  if (!rl || (rl as unknown as { closed: boolean }).closed) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return rl;
}

export function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    getReadline().question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

export function closeReadline(): void {
  rl?.close();
  rl = null;
}

/**
 * Ask for a y/n confirmation. Returns true for 'y', false for anything else.
 */
export async function confirm(question: string): Promise<boolean> {
  const answer = await ask(`${question} [y/n] `);
  return answer.toLowerCase() === "y";
}
