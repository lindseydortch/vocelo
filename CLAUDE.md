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
- No tests, no merge. Every ticket ships with tests; npm run verify must pass. See "Testing Requirements" in GIT_WORKFLOW.md.

## Commit messages and PR descriptions
End every commit message and PR description with its own body text. Leave out all Claude attribution: no `Co-Authored-By: Claude` or `Claude-Session` trailers, no "Generated with Claude Code" footer, no session links. This applies to every commit and PR in this project, including squash-merge messages.

## Git workflow (MANDATORY)
- One issue = one branch = one folder = one port = one browser profile = one agent.
- You are assigned exactly ONE issue. Only work on that issue.
- Never start, work on, or close an issue labeled `human`. If your ticket turns out to need a human step,
  STOP and report it so the human can split it into a `human` ticket that blocks yours.
- Never start an issue with an unresolved blocker (`./scripts/ticket-next.sh --check <N>` fails).
  Do not work around it, partially implement it, or stub the blocker's code. Report and wait.
- Starting a ticket: when you're given an issue number (e.g. `/implement #12`) and no `.ticket.env` exists
  for it, start it yourself with `./scripts/ticket-start.sh <N> <slug> <type>`. Run it from the main folder.
  `<type>` is the title prefix before the colon (`feat`, `chore`, `fix`); `<slug>` is 2–4 kebab-case words from the rest of the title
  (letters, digits, hyphens only). If the main folder already has an active `.ticket.env`, add `--worktree`
  and do all work in the folder it prints. If the script refuses (blocked, human, closed), STOP and report.
- BEFORE editing, committing, running servers, or opening browsers, run `./scripts/ticket-check.sh`.
  If it fails, STOP and report. Do not try to fix it by switching branches or folders.
- Never run `git switch`, `git checkout <branch>`, or `git worktree add/remove` yourself (only `ticket-start.sh` does).
- Never edit files outside your ticket folder (`TICKET_DIR` in `.ticket.env`).
  Never edit the main repo folder when assigned a worktree.
- Only use the `PORT` and `BROWSER_PROFILE` from `.ticket.env`.
  Never touch another issue's branch, port, browser, or folder.
- If you notice work that belongs to a different issue, write it down in the PR description; do not do it.
- Use Conventional Commits that reference the issue number.
- Every ticket ships with tests per "Testing Requirements": happy path + at least one failure case,
  mapped to acceptance criteria. Never call real external APIs in tests. Never use `.skip` or `.only`.
- Run `npm run verify` and make it pass before opening a PR. Never weaken a test or lower a
  coverage threshold to make CI pass.
- Open one PR into `dev` with "Closes #<issue>" and the Testing section filled in, then enable auto-merge:
  `gh pr merge <PR#> --auto --squash`. All ticket PRs into `dev` auto-merge once CI passes; the human does
  not merge them by hand. Never merge any other way. Never run `git merge`.
- The only manual merge is the final `dev` → `main` release PR, done by the human.
- Never run cleanup yourself. It is automatic: `scripts/ticket-sweep.sh` runs from `ticket-start.sh` and
  `ticket-next.sh` and removes every ticket whose PR merged into `dev` (local worktree and branch, remote branch).
  The human can also run `./scripts/ticket-sweep.sh` or `./scripts/ticket-cleanup.sh <issue>` any time.

## Assumptions log
When you make an assumption, deviate from a ticket's wording, or pick a default the docs didn't specify,
add a row to `context/assumptions.md` in the same PR: ticket number, the assumption, and a label:
`need to review` (human must confirm; could be wrong or costly) or `nice to know` (low risk, FYI).
Since PRs auto-merge, this file is how the human catches decisions after the fact.
