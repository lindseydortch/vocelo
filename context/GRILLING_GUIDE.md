# Vocelo Grilling Guide

Run one grilling session per area, in order. Each session updates `project-bible.md` and drafts tickets, so the next session builds on it.

## Step 0: Kickoff (whole app, run once, ~20–30 min)
Not deep grilling. A sanity check of the full plan before going feature by feature.
```
Read `context/CLAUDE.md` and the docs it lists. Before we grill feature by feature, review the whole plan as a skeptical tech lead. Don't write tickets yet. Give me:
1. Conflicts or contradictions between features, docs, or decisions
2. Gaps: anything the MVP needs that isn't in the plan
3. A reality check: is this MVP buildable in one day with parallel agents? Recommend specific cuts or simplifications if not.
4. The critical path: what must exist before what, and which areas can be built in parallel
5. A dependency map of the feature areas in `GRILLING_GUIDE.md`, in the order you'd build them
Ask me questions where you need decisions. Then update `project-bible.md` with what we agreed.
```

## Feature Prompt (steps 1–11: copy, paste, swap the area)
```
Read `context/CLAUDE.md` and the docs it lists. Grill me only on **[AREA]**. Go deep on edge cases, failure states, and how each plan tier behaves. Flag conflicts with other features. Anything not in the MVP list is a stretch goal unless I promote it. When we're done, update `project-bible.md` with the decisions and draft the tickets. Keep tickets small, following the rule in `CLAUDE.md`; split anything bigger.
```

## Order

| # | Area | Focus | Depth |
|---|---|---|---|
| 0 | **Kickoff (whole app)** | Conflicts, gaps, one-day reality check, critical path, dependency map | 👀 Broad, not deep |
| 1 | **Open decisions + data model** | LLM provider, hosting provider; tables for users, Buffer tokens, posts, versions, personas, reactions, usage, images, subscriptions | 🔥 Deep |
| 2 | **Infrastructure + repo setup** | Repo scaffold, Neon branches + seed data, R2 + domain/DNS, CI + hosting, env vars | 🔥 Deep |
| 3 | **Buffer sign-in** | OAuth + PKCE, `account` lookup, sessions, token storage + refresh, sign out vs. disconnect | 🔥 Deep |
| 4 | **Buffer integration** | Channels (text-first filter), drafts, Ideas, images via R2, scheduling | 🔥 Deep |
| 5 | **Billing** | Stripe Checkout, webhooks, Customer Portal, plan limits, usage counters, history window, downgrades | 🔥 Deep |
| 6 | **Composer** | Editor, voice-to-text (Scribe + fallback), image upload + compression, character counts | ⚡ Medium |
| 7 | **Personas + playback** | Standard personas, custom voice avatars, read aloud, highlight-to-hear, audio caching | ⚡ Medium |
| 8 | **Reactions + tone** | Persona reactions, whole-post tone heat map, prompts, plan gating | ⚡ Medium |
| 9 | **Versions + scheduling** | Version history, restore, Schedule via `editPost` (renamed from "approve & schedule" in Step 9) | ⚡ Medium |
| 10 | **Pages** | All 15 pages from the sitemap: structure, states, routes (copy written separately) | 💨 Quick |
| 11 | **Design Pass** | Direction, palette, fonts, logo, avatars, mobile pass | 💨 Quick (do last) |

## Tips
- **Step 2 produces several tickets:** #1 repo scaffold (must merge first), then database, images + domain, and CI + hosting, which can run in parallel worktrees.
- **Don't skip ahead.** Later areas depend on decisions from earlier ones (e.g., billing needs the data model, Buffer integration needs sign-in).
- **Time-box the quick areas** so you start building tonight or first thing tomorrow.
- After each session, delete settled items from "Open decisions" in `CLAUDE.md`.