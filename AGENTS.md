# Vocelo: Start Here
**Vocelo** is a one-day Buffer API hackathon app: users write a post, save it as a Buffer draft, and hear it read aloud by different personas to learn how it lands. The MVP must be fully functional (real Buffer OAuth, real Stripe billing).

## Read before doing anything
1. `context/project-bible.md`: **source of truth** for scope, stack, decisions, pages, and infra
2. `context/pricing-tiers.md`: plans, usage limits, history window
3. `context/GIT_WORKFLOW.md`: branching, worktrees, ticket scripts, agent rules, who merges
4. `context/environments.md`: which keys, database, and providers each environment uses
5. `context/build-order.md`: which tickets to work in what order (snapshot; `./scripts/ticket-next.sh` is the live view)

Don't duplicate these docs. If they conflict, **ask the human**; don't pick one silently.

## Open decisions (delete each line once decided and recorded in `context/project-bible.md`)
- Design direction (decided last, in the Design Pass)

## Tickets (GitHub Issues)
Title `<type>: <description>` · labels (`MVP`/`stretch` + area, plus `human` if only the human can do it) · acceptance criteria (incl. "works on desktop 1280px+") · plan behavior · **Blocked by** (in the body *and* as native GitHub links) · files likely touched · out of scope.

**Human work** gets its own `human` ticket (drafts in `context/tickets/00-human.md`); never mix a human step into an agent ticket. **Never start a ticket with an unresolved blocker**: `ticket-start.sh` enforces it, and `./scripts/ticket-next.sh` shows what's ready. Rules: `context/GIT_WORKFLOW.md` → "Human Tickets + Blockers".

**Keep tickets small:** one concern, ~1–2 hours, a handful of files, and mergeable + testable on its own. If a ticket has "and" in its title or more than ~5 acceptance criteria, split it.

## Non-negotiables when building- One issue = one branch = one folder = one port = one agent. Follow `context/GIT_WORKFLOW.md` exactly.
- No visual design until the Design Pass. `rem` only (1rem = 10px). Desktop-first. Details in `context/project-bible.md`.
- Secrets and plan enforcement stay server-side.

## Code review
Use `dev` as the default comparison point for code reviews (`git diff dev...HEAD`), unless the user explicitly requests another reference.
