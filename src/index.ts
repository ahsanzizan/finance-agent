import { ollamaClient } from "./client";

async function main() {
  const isAlive = await ollamaClient.health();

  if (!isAlive) {
    console.error("Ollama is not running");
    process.exit(1);
  }

  console.log("Ollama is running");

  const response = await ollamaClient.chat({
    messages: [
      {
        role: "system",
        content: "You are a financial analysis assistant. Be concise.",
      },
      {
        role: "user",
        content: "What is Dollar Cost Averaging in one sentence?",
      },
    ],
    options: { temperature: 0.1 },
  });

  const reply = response.choices[0]?.message.content;
  console.log("Model:", reply);
}

main().catch(console.error);
