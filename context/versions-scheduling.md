# Versions + Scheduling: Why the Rules Are What They Are

The rules themselves live in `project-bible.md` → "Step 9 Decisions". This doc records **why** each rule was chosen, so nobody "fixes" one without knowing what it protects.

Buffer facts used below come from developers.buffer.com (checked 2026-11-13).

---

## Naming: "Schedule", not "Approve & schedule"

- The MVP has no reviewer approvals. Team approvals are stretch.
- "Approve" suggests a sign-off step by someone else that doesn't exist. A user who sees it would look for an approver.
- **Schedule** is what the action does: it hands the post to Buffer's publishing queue. The button reads "Schedule in Buffer".

## Schedule options: queue or a picked time only

| Option | Buffer mode | MVP? | Why |
|---|---|---|---|
| Add to queue | `addToQueue` | ✅ | Uses the posting schedule the user already set in Buffer. No timezone questions. |
| Pick a time | `customScheduled` + `dueAt` | ✅ | The common "post this Tuesday at 9" case. |
| Share now | `shareNow` (enum value not confirmed in docs) | ⏳ Stretch | Publishes publicly within seconds. One mis-click in a live demo posts to a real LinkedIn. |
| Share next | `shareNext` (not confirmed) | ⏳ Stretch | Small win over "Add to queue"; extra UI and test cases. |

## One click: save, then schedule

**Rule:** Schedule runs `flush()` → `saveDraft` (writes a version if the text changed) → `editPost { id, mode, dueAt? }`. It counts as **1 Buffer write**.

**Why:**
- The text in the editor may not be in Buffer yet. Scheduling without saving would publish the old Buffer text, which isn't what the user just heard and reviewed.
- Reusing `saveDraft` means every save edge case (draft deleted in Buffer, channel disconnected, over the limit) is handled once, in Step 4's code.
- Saving first also means a version always exists for the exact text that was scheduled.
- **1 write, not 2:** the 30/hour cap protects Buffer's rate limit from runaway clicking. One user action = one count keeps the message ("You've saved a lot this hour") honest.
- **Partial failure** (save works, schedule fails) leaves a normal saved draft. That's a safe state, so we report it ("Saved as a draft in Buffer, but couldn't schedule: {reason}") instead of rolling back.

## Move back to draft (fixes a Step 4 conflict)

**Problem:** Step 4 only offered "Save as a new draft" for a scheduled post. That creates a second Buffer post and leaves the old one scheduled. **The old text still publishes.** The user thinks they fixed the post; Buffer posts the version they meant to replace.

**Rule:** when the status is `scheduled`, the banner offers **"Move back to draft"** first (`editPost { id, saveToDraft: true }`, 1 Buffer write), then "Save as a new draft".

**Why `scheduled` only:** `sent` and `sending` can't be pulled back (already out or going out). `needs_approval` and `error` keep Step 4's behavior.

## Timezone: the user's, labelled

**Rule:** "Pick a time" shows times in `users.timezone` (the Buffer account timezone), falling back to the browser. Every time shown carries its zone label, e.g. "3:00 PM America/Chicago".

**Why:**
- `dueAt` is a fixed moment in UTC. The timezone only changes how it's **shown**, never when it posts.
- The person clicking thinks in their own local time.
- Buffer channels have their own timezone, defaulting to **Europe/London** if never set. Showing that would surprise most users.
- The label removes any doubt, so we don't need a channel-timezone hint in the MVP.
- The dashboard badge and the composer use the same zone so the time never looks different in two places.

## Time rules: 5 minutes to 1 year ahead

**Rule:** a picked time must be at least **5 minutes** and at most **1 year** from now. Checked in the browser and again on the server. Default = the next full hour that's at least 5 minutes away. A time that passes while the dialog is open is rejected on submit: "Pick a time at least 5 minutes from now."

**Why:**
- Buffer doesn't document its own past/minimum/maximum rules. Our own bounds give a clear message instead of a surprise Buffer error.
- **5 minutes** leaves room for the save + schedule round trip and clock drift between browser, server, and Buffer. Anything sooner is really "Share now", which is stretch.
- **1 year** catches typos (2027 instead of 2026) without blocking any real plan.
- **Server re-check** because the client can be wrong or tampered with, and the dialog can sit open past the chosen time.
- **Next full hour** default: a sensible time that's never in the past.

## What blocks Schedule

**Rule:** the same blocks as Save draft:

| Block | Why |
|---|---|
| Blank text | Nothing to post. |
| Over the channel's limit | Buffer would reject it; we say why first. |
| Channel disconnected or locked | Buffer can't post to it. |
| Status isn't `draft` (or no Buffer post yet is fine: the save creates one) | Only drafts can be scheduled; other statuses use the banner actions. |
| Sample post | Read-only, never touches Buffer. |
| Locked post | Can't be opened on the user's plan. |

**Not a block:**
- **Hearing the post first.** Vocelo shows how a post lands; it doesn't police the user. A forced listen would slow down someone who already knows the post is fine.
- **Plan.** Scheduling is the same on Free and Creator and never counts as a reviewed post. Buffer actions are never a paid feature (Step 4), and charging for the step that sends users back to Buffer would work against the partnership.

## Version panel

**Rule:** newest first; each row = time saved, first ~80 characters, character count; newest gets "In Buffer". Click a row → full text read-only + **Restore**. Free: newest 3 + "🔒 N older versions. Upgrade to see them" → Checkout. Creator: all. Hidden on the sample post. Diff view is stretch.

**Why:**
- A preview + count is enough to recognise a version without a diff view, which is a bigger build.
- "In Buffer" answers the most common question ("which one is live?").
- The locked line is a second upgrade trigger and follows the pricing rule: hide, never delete.

## Restore guard

**Rule:** if the current text differs from the newest version, restoring asks first: "Your current text isn't in Buffer and isn't saved as a version. Replace it?" Restoring a version equal to the current text is disabled ("Current"). The server rejects restoring a version the plan hides.

**Why:**
- Versions are only made on a Buffer save. Text that's only autosaved has no version, so restoring over it would lose it for good.
- Restore never rewrites history: it loads text into the editor, which autosaves; the next Save draft creates a new version.
- The server check stops a Free user restoring a hidden version by guessing its ID.

## Buffer failures

| Case | Rule | Why |
|---|---|---|
| Does `editPost` schedule a draft? | Ship `editPost { id, mode, dueAt?, saveToDraft: false }`; **H12** confirms it on a test channel before K2 starts. | Buffer's docs don't say. A 15-minute human check beats an agent guessing and a demo-day surprise. Fallback (`createPost` with the mode) would drop images added in Buffer, so it's a last resort. |
| Queue full (`LimitReachedError`) | Stays a saved draft; show Buffer's message + "Remove a scheduled post in Buffer or upgrade your Buffer plan." No pre-check. | The limit belongs to the user's Buffer plan, not Vocelo's. Buffer's error is the source of truth; a pre-check would cost a call and could still be wrong. |
| Paused queue (`isQueuePaused`) | Warn, don't block. | Buffer accepts the post; it just won't go out yet. The user may resume the queue later, so blocking would be wrong, but silence would let them think it's posting. |
| Add to queue result | Read back `status` + `dueAt`; "Queued for {time}" or "Added to your Buffer queue". | Buffer picks the time, and with no posting schedule it may not return one. We show what we know and never invent a time. |
| `needs_approval` result | Store it; "Sent for approval in Buffer." | Some Buffer orgs require approval. Calling it "Scheduled" would be false. Approval happens in Buffer; Vocelo never sends `approvalChange`. |
| Already scheduled in Buffer / deleted in Buffer | Reuse `saveDraft`'s pre-check: `NOT_A_DRAFT` → banner; deleted → recreated, then scheduled. | One code path for every Buffer-side surprise. |

## After scheduling

- **Per-status banner (replaces C10's generic text):** "This post is scheduled in Buffer" doesn't say *when*, and the user's next question is always "when?" or "can I pull it back?".
- **Move back to draft, re-checked first:** the stored status can be stale (the user may have acted in Buffer). Checking first means we never "move back" a post that already went out, and never fail confusingly on one that's gone.
- **No "Change time" in MVP:** Move back to draft + Schedule covers it in two clicks, with no new Buffer behavior to verify.
- **Cmd/Ctrl+S never schedules:** a muscle-memory shortcut must never publish anything.
- **Version tag follows status:** "In Buffer" on a scheduled or posted version would be vague; the tag answers "which text is live, and in what state".
- **Restore on Free can push the oldest visible version out of view, with no warning:** nothing is deleted, the locked line already shows the count, and a warning on every restore would be noise.

## Demo safety

Scheduling in the demo is real and would publish to a real account. The demo schedules only to a **test channel** (H13), **1 week out**, then clicks **Move back to draft** on stage: it shows both directions and nothing ever posts. Add to queue is never used on a real channel during the demo, because its time depends on the posting schedule and could be minutes away.
