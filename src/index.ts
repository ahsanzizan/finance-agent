import { OllamaClient } from "./client";

const client = new OllamaClient();

console.log(await client.health());
