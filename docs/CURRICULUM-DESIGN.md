# Curriculum design and gap analysis

Reference: [Outcome School — AI and Machine Learning Program](https://outcomeschool.com/program/ai-and-machine-learning), retrieved 2026-11-07.

The reference is a 100-hour engineer track (build an LLM, internals, system
design, MLOps, RL). This platform is a PM and enterprise learning platform, so
the goal is **not** to copy it topic for topic. The goal is to use its technical
spine to close real gaps, while keeping the business, safety, and vendor material
that the reference does not cover.

The structure lives in `content/curriculum-plan.json` and is rendered at
`/curriculum/`.

---

## 1. What the reference covers

| Domain | Topics | Current coverage | Decision |
|---|---|---|---|
| AI Engineering | LLM fundamentals, tokenization, attention, KV cache, PagedAttention, speculative decoding, batching, MoE, vLLM, prompting, CoT, context engineering, security, injection, RAG, vector DBs, fine-tuning, PEFT, LoRA, quantization, distillation, SLMs, ReAct, agents, tools, memory, MCP, subagents, multi-agent, orchestration, evals, LLM-as-judge, multimodal | **~50%** | Add internals + inference, fine-tuning, quantization, multimodal; keep existing agent/RAG/security depth |
| Build Your Own | LLM, ChatGPT, AI tutor, coding agent, memory, neural network | **0%** | Add a lab track (P1). Highest motivation value, but needs working code |
| AI Coding Agent | Claude Code, Codex, loop, graph, harness | **~25%** (harness only) | Add loop/graph engineering (P1) |
| System Design | Numbers, ChatGPT end-to-end, RAG, memory, deep research, voice, vLLM-as-a-service | **~10%** (scattered) | Add a dedicated system-design track (P0) |
| Tools & Libraries | PyTorch, TF, Keras, Ollama, HF, LangChain, LangGraph | **~30%** (free tools lab) | Extend labs opportunistically; not a PM priority |
| Data Analysis | NumPy, Pandas, Matplotlib, Seaborn | **0%** | Out of scope for the PM lens; keep as optional appendix later |
| ML Fundamentals | Supervised/unsupervised, self-supervised, contrastive, regression, gradient descent, loss, hyperparameters, embeddings, logits | **~5%** | Add an essentials track (P0) |
| Deep Learning | NN, FFNN, activations, backprop, dropout, normalization, optimizers | **0%** | Fold the useful parts into ML Essentials and LLM Internals; no separate DL track |
| Generative AI | VAEs, autoregressive, diffusion, transformers, attention, LLMs, reasoning, encoder-decoder, multimodal, scaling | **~35%** | Covered by LLM internals + multimodal; add diffusion/VAE as items, not a whole track |
| MLOps / LLMOps | Inference engineering, bottlenecks, metrics, data versioning, training, deployment, cloud vs device, monitoring | **~25%** (GPU track + evals) | Add an MLOps track for PMs (P1) |
| Reinforcement Learning | Exploration/exploitation, PPO, reward models, DPO, GRPO, RLHF | **0%** | Add one track (P1) because every reasoning-model launch references it |
| Research Papers | Attention Is All You Need, Distilling the Knowledge | **0%** | Add a papers club (P2) |

**Overall technical coverage: ~30% today.** With the planned tracks it rises to
~90% of the reference scope, while the existing PM, safety, economics, and
vendor material remains the differentiator.

---

## 2. What this platform already does better

Worth protecting during any restructure:

- **Token economics** — a full track on cost, caching, and pricing models.
- **OWASP LLM Top 10 and a standalone injection taxonomy** — deeper than the
  reference's single "AI Security" and "Prompt Injection" bullets.
- **Enterprise data moats** — Glean, Kroolo, and the data-strategy layer.
- **Vendor deep dives** — Anthropic, OpenAI, Perplexity, computer use.
- **PM spec writing** — turning AI concepts into PRD decisions.
- **Evals for PMs** — what to measure and how to judge a vendor's claims.

---

## 3. Target structure (8 stages, 34 sections)

Live: **22**. Planned: **12**. Each planned section is scoped to 5–7 items.

| Stage | Purpose | Live | Planned |
|---|---|---|---|
| 0 · Foundations | ML essentials + the numbers every PM needs | 1 | 2 |
| 1 · How LLMs work | Tokens → attention → inference → prompting → context | 3 | 1 |
| 2 · Knowledge & memory | RAG, pipeline engineering, advanced retrieval, memory | 4 | 0 |
| 3 · Agents & tools | Loops, tools/MCP, orchestration, harness, coding agents, voice | 4 | 2 |
| 4 · Quality, safety, cost | Evals, OWASP, injection, token economics, MLOps | 4 | 1 |
| 5 · Training & adaptation | Fine-tuning/LoRA, quantization/distillation, RLHF/DPO | 0 | 3 |
| 6 · Infrastructure & system design | GPUs, AI system design, build-your-own labs | 1 | 2 |
| 7 · Enterprise, providers, research | Vendor deep dives, data moats, papers club | 6 | 1 |

Planned sections, in priority order:

| Priority | Section | Depends on | Why now |
|---|---|---|---|
| P0 | Machine Learning Essentials | — | The vocabulary every other track assumes |
| P0 | Numbers Every AI PM Should Know | ML Essentials | Reusable reference for cost, latency, memory |
| P0 | LLM Internals & Inference | Tokens track | Stops vendor hand-waving about KV cache and batching |
| P0 | Fine-tuning, PEFT & LoRA | LLM Internals, Evals | The prompt-vs-RAG-vs-fine-tune decision |
| P0 | Quantization, Distillation & SLMs | LLM Internals | Edge/on-device and cost decisions |
| P0 | AI System Design for PMs | RAG pipeline, Agents | Interview and architecture skill in one track |
| P1 | Loop & Graph Engineering | Harness | Coding agents are the current default workflow |
| P1 | Multimodal & Voice Agents | Agent Loops | Voice is the fastest-growing product surface |
| P1 | MLOps & LLMOps for PMs | Evals, Token Economics | Operate what you ship |
| P1 | RLHF, DPO & Reasoning Models | Fine-tuning | Explain reasoning-model launches |
| P1 | Build-Your-Own Labs | LLM Internals, RAG pipeline | Turns theory into evidence of skill |
| P2 | Research Papers Club | LLM Internals | Depth without a new dependency |

---

## 4. Prerequisite graph

```
ML Essentials
  └── Numbers Every AI PM Should Know
  └── Tokens, Context Windows, Temperature
        ├── LLM Internals & Inference
        │     ├── Fine-tuning, PEFT & LoRA
        │     │     └── RLHF, DPO & Reasoning Models
        │     ├── Quantization, Distillation & SLMs
        │     └── Research Papers Club
        ├── Prompting & AI Spec Writing
        │     └── Context Engineering
        │           ├── Retrieval & RAG
        │           │     └── RAG Pipeline Engineering
        │           │           ├── Retrieval Beyond Basic RAG
        │           │           └── Memory Systems
        │           ├── Agent Loops
        │           │     ├── Skills vs Tools vs MCP
        │           │     │     └── Agent Building & Orchestration
        │           │     │           └── Harness Engineering
        │           │     │                 └── Loop & Graph Engineering
        │           │     └── Multimodal & Voice Agents
        │           ├── Evals
        │           │     └── MLOps & LLMOps
        │           └── Security → Injection Deep Dive
        └── Token Economics
              └── GPU & AI Infrastructure
                    └── AI System Design for PMs
                          └── Build-Your-Own Labs
```

---

## 5. Quality targets for new items

Every planned section should ship with:

- 5–7 items, at least 60% at L3+.
- One lab or worked example for P0 sections.
- Level mix per section: L1 15% · L2 25% · L3 30% · L4 20% · L5 10%.
- Every item carries `sourceRefs` with a URL and a verbatim quote.
- No item that duplicates an existing stem (cosine < 0.92).

Target end state: **~152 live + ~70 new = ~220 items**, roughly 7–8 per
section, with every stage covered at L3+.

---

## 6. How to promote a planned section

1. Add the section to `content/kb.json` with the same `id` used in
   `content/curriculum-plan.json` (`items` must have at least one item).
2. Write or generate 5–7 items, run `npm run validate` and `npm run quiz:lint`.
3. Change `"status": "planned"` to `"status": "live"` in the plan.
4. Regenerate bundles with `npm run notebooks`.
5. Build and check `/curriculum/` shows the stage counts change.

If an id in the plan is marked live but missing from `kb.json`, the curriculum
page fails the build on purpose. That keeps the plan from drifting.

---

## 7. What to do next

1. Seed **Machine Learning Essentials** and **LLM Internals & Inference** first —
   they unblock five other planned sections.
2. Then **AI System Design for PMs**, because it reuses existing RAG and agent
   material and needs less new source collection.
3. Leave **Build-Your-Own Labs** until the content agent and the site’s Ask
   feature exist; the labs should use the platform itself.

See `docs/SCALE-UP-PLAN.md` for the source collection, quiz lint, agent, vector
search, and Ask Anything build order.
