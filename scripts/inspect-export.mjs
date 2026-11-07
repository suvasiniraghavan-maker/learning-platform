import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const file = resolve(process.argv[2] ?? "");
const raw = JSON.parse(await readFile(file, "utf8"));

function describe(value, depth = 0) {
  if (Array.isArray(value)) {
    return `array(${value.length})` + (value.length && depth < 2 ? ` first=${describe(value[0], depth + 1)}` : "");
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).slice(0, 12);
    return `object{${keys.join(", ")}}`;
  }
  if (typeof value === "string") return `string(${value.length})`;
  return `${typeof value}:${value}`;
}

console.log("top-level:", describe(raw));

const chats = raw.data ?? raw.chats ?? (Array.isArray(raw) ? raw : [raw]);
console.log("chats:", Array.isArray(chats) ? chats.length : "not array");

for (const [chatIndex, chat] of (Array.isArray(chats) ? chats : [chats]).entries()) {
  console.log(`\n=== chat ${chatIndex} ===`);
  console.log("keys:", Object.keys(chat).join(", "));
  console.log("title:", chat.title ?? chat.name ?? "(none)");
  const inner = chat.chat ?? chat;
  console.log("inner keys:", Object.keys(inner).join(", "));
  console.log("inner.history keys:", inner.history ? Object.keys(inner.history).join(", ") : "(none)");

  const messages =
    (Array.isArray(inner.messages) && inner.messages) ||
    (Array.isArray(inner.history?.messages) && inner.history.messages) ||
    (Array.isArray(chat.messages) && chat.messages) ||
    [];
  console.log("messages:", messages.length);

  if (!Array.isArray(messages)) continue;

  for (const [index, message] of messages.entries()) {
    const parts = Array.isArray(message.content_list) ? message.content_list : [];
    const answerParts = parts.filter((part) => part?.phase === "answer" && part?.content);
    const text =
      typeof message.content === "string" && message.content.length > 0
        ? message.content
        : answerParts.map((part) => part.content).join("\n\n");
    const preview = text.replace(/\s+/g, " ").slice(0, 110);
    console.log(
      `  [${index}] role=${message.role ?? "?"} type=${message.chat_type ?? "?"} chars=${text.length} parts=${parts.length} answers=${answerParts.length} :: ${preview}`,
    );
  }
}
