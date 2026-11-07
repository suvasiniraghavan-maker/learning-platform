import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const file = resolve(process.argv[2] ?? "");
const outDir = resolve(process.cwd(), "exports");
const raw = JSON.parse(await readFile(file, "utf8"));
const chats = raw.data ?? raw;
const chat = (Array.isArray(chats) ? chats[0] : chats).chat ?? (Array.isArray(chats) ? chats[0] : chats);
const messages = chat.messages ?? chat.history?.messages ?? [];

await mkdir(outDir, { recursive: true });

let saved = 0;
for (const [index, message] of messages.entries()) {
  const parts = Array.isArray(message.content_list) ? message.content_list : [];
  const answers = parts.filter((part) => part?.phase === "answer" && part?.content);

  let text =
    typeof message.content === "string" && message.content.length > 0
      ? message.content
      : answers.map((part) => part.content).join("\n\n");

  if (!text) continue;

  const name = `msg-${String(index).padStart(2, "0")}-${message.role}.md`;
  await writeFile(resolve(outDir, name), text, "utf8");
  saved += 1;
  console.log(`wrote ${name} (${text.length} chars)`);
}

console.log(`\n${saved} message(s) written to ${outDir}`);
