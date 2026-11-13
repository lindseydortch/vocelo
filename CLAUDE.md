# Vocelo: Start Here

**Vocelo** is a one-day Buffer API hackathon app: users write a post, save it as a Buffer draft, and hear it read aloud by different personas to learn how it lands. The MVP must be fully functional (real Buffer OAuth, real Stripe billing).

## Read before doing anything
1. `project-bible.md`: **source of truth** for scope, stack, decisions, pages, and infra
2. `pricing-tiers.md`: plans, usage limits, history window
3. `GIT_WORKFLOW.md`: branching, worktrees, ticket scripts, agent rules

Don't duplicate these docs. If they conflict, **ask the human**; don't pick one silently.

## Open decisions (delete each line once decided and recorded in `project-bible.md`)
- LLM provider (persona reactions + tone heat map)
- Hosting provider
- Design direction (decided last, in the Design Pass)

## Tickets (GitHub Issues)
Title `<type>: <description>` · labels (`MVP`/`stretch` + area) · acceptance criteria (incl. "works on desktop 1280px+") · plan behavior · dependencies · files likely touched · out of scope.

**Keep tickets small:** one concern, ~1–2 hours, a handful of files, and mergeable + testable on its own. If a ticket has "and" in its title or more than ~5 acceptance criteria, split it.

## Non-negotiables when building
- One issue = one branch = one folder = one port = one agent. Follow `GIT_WORKFLOW.md` exactly.
- No visual design until the Design Pass. `rem` only (1rem = 10px). Desktop-first. Details in `project-bible.md`.
- Secrets and plan enforcement stay server-side.