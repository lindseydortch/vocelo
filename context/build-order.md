# Build order

Order to work the open GitHub issues, as of 2026-11-13. Numbers are GitHub issue numbers. 👤 = `human` ticket (only you can do it). `<-` lists blockers.

**Live view:** `./scripts/ticket-next.sh` shows what is ready right now. This file is a snapshot; if it disagrees with GitHub, GitHub wins.

## Not all of infra comes first

Only a thin chain gates the rest. ESLint, CI, and branch protection do not block feature work.

**The gate chain (do in this order):**
1. 👤 #1 Neon project (also unblocks everything database-related)
2. #6 env validation (PR #159 is open)
3. #7 Drizzle migration tooling
4. #17 database schema and #35 embedded Postgres harness (in parallel)
5. #42 test factories, then #43 session cookie, then #44 E2E sign-in helper, then #62 protected app routes

Almost every feature ticket sits behind #17, #35, or #43. #6 alone gates 127 tickets.

**Merge plumbing (do soon, but not on the gate chain):**
- `gh pr merge --auto` fails until branch protection exists. Chain: #69 ESLint -> #70 CI (also needs #35) -> #71 branch protection.
- Until #71 lands, PRs need a manual merge.

**Human tickets to do in parallel while agents build (all start with no blockers):**
- 👤 #1 Neon, 👤 #2 ElevenLabs, 👤 #3 Anthropic key, 👤 #16 Stripe test mode, 👤 #68 demo test channel
- 👤 #22 Cloudflare DNS is stretch; skip until the rest is done.

**Can start today alongside #6 (no blockers):** #12, #23, #28, #38, #39, #65, #69, #102, #138.

## Waves

A ticket appears in the first wave where all its blockers are in earlier waves. Everything within a wave can run in parallel (one agent each).

### Wave 1
- 👤 #1 create Neon project <- -
- 👤 #2 set up ElevenLabs <- -
- 👤 #3 create Anthropic API key <- -
- #6 env validation <- -
- #12 public route stubs <- -
- 👤 #16 configure Stripe test mode <- -
- 👤 #22 point DNS to Cloudflare (stretch) <- -
- #23 voice and icon catalogs <- -
- #28 tone label catalog <- -
- #38 per-channel character counter <- -
- #39 shared text normalization <- -
- #65 schedule time helpers <- -
- 👤 #68 demo test channel for scheduling <- -
- #69 ESLint config <- -
- #102 audio store <- -
- #138 shared pending state <- -
### Wave 2
- #7 Drizzle migration tooling <- #1, #6
- #13 privacy and terms text <- #12
- #24 TTS provider module <- #2, #6
- #50 Buffer GraphQL client <- #6
- #51 token encryption helper <- #6
- #72 OAuth start route <- #6
### Wave 3
- #8 Netlify deploy config <- #6, #7
- 👤 #14 publish privacy and terms pages <- #13
- #17 database schema <- #7
- #30 LLM client module <- #3, #7
- #33 usage module stub <- #7
- #35 embedded Postgres test harness <- #7
- #76 auth error page <- #72
- #144 landing page sections <- #12, #72
### Wave 4
- 👤 #9 create Netlify site <- #8
- #18 Stripe client module <- #6, #17
- #25 standard personas migration <- #2, #17
- #31 LLM client hardening <- #28, #30
- #32 usage period calculator <- #17
- #40 seed runner <- #17, #35
- #42 test factories <- #17, #35
- #52 token refresh with row lock <- #35, #50, #51
- #58 sign-in schema additions <- #17, #35
- #70 GitHub Actions CI <- #35, #69
### Wave 5
- 👤 #15 register production Buffer app client <- #9, #14
- #19 apply subscription from Stripe <- #18
- #26 static audio generation script <- #23, #24, #25
- #29 reaction and tone prompts <- #25
- #34 usage limits enforcement <- #17, #32, #33
- #36 persona schema additions <- #17, #25, #35
- #37 history window filter <- #17, #32
- #41 seed data <- #25, #40
- #43 session cookie module <- #6, #17, #35, #42
- #53 retry Buffer calls after auth error <- #52
- #59 Buffer integration schema additions <- #17, #58
- #71 branch protection script <- #70
- #96 Customer Portal link <- #16, #18
### Wave 6
- #20 Stripe webhook route <- #19
- 👤 #27 generate static audio files <- #2, #26
- #44 E2E sign-in helper <- #8, #42, #43
- #54 Buffer read queries <- #50, #53
- #60 Buffer write cap <- #34, #59
- #73 complete sign-in <- #43, #50, #51, #58
- #85 autosave post text <- #17, #37, #39, #43
- #93 Creator checkout session <- #18, #43
- #98 usage summary <- #32, #34
- #104 audio fetch route <- #43, #102
- #106 custom persona server functions <- #23, #32, #36, #43
- #130 sample and fixture analysis content <- #28, #30, #41
- #145 landing persona showcase <- #23, #26, #144
### Wave 7
- 👤 #21 add production Stripe webhook <- #9, #20
- #45 billing test presets <- #34, #41, #42, #44
- #55 queue-paused flag in Buffer reads <- #54
- #56 Buffer write mutations <- #54
- #62 protected app routes <- #43, #44
- #74 OAuth callback route <- #72, #73
- #79 dev sign-in with personal API key <- #8, #73
- #80 cached channel list <- #54, #59
- #94 checkout success page <- #19, #93
- #97 plan-aware pricing CTAs <- #12, #93, #96
- #105 audio player <- #104
- #126 reactions panel loader <- #28, #32, #37, #106
- #137 not-found and error pages <- #44
- #140 sample post on first sign-in <- #26, #73
### Wave 8
- #46 read request validation <- #36, #37, #38, #39, #45
- #57 Buffer schedule mutations <- #56
- #63 composer route shell <- #17, #37, #44, #62
- #75 sign-in page <- #62, #72
- #77 sign out <- #43, #62
- #82 save new post to Buffer <- #38, #56, #60
- #88 importable drafts list <- #38, #80
- #90 dashboard post list <- #37, #39, #62
- #95 checkout canceled page <- #62
- #99 billing settings page <- #45, #96, #98
- #100 app shell header <- #12, #62
- #122 personas page <- #45, #62, #93, #106
- #146 pricing comparison table <- #12, #97
- #148 store Buffer display names <- #7, #73, #79
### Wave 9
- #47 get reaction server function <- #29, #31, #34, #46
- #61 move back to draft server function <- #57, #60
- #64 sync Buffer status on composer open <- #54, #63
- #78 disconnect Buffer <- #43, #62, #77
- #81 channel picker on new post <- #63, #80
- #83 save existing draft to Buffer <- #82
- #86 composer editor with autosave <- #63, #85
- #89 import a Buffer draft <- #60, #88
- #92 dashboard Buffer status badges <- #59, #65, #90
- #101 payment failed banner <- #96, #98, #100
- #103 generate or reuse audio <- #24, #34, #46, #102
- #107 persona picker <- #23, #63, #106
- #111 locked history teaser card <- #37, #90, #93
- #112 composer usage meter <- #63, #98
- #119 delete post <- #63
- #123 custom persona builder form <- #105, #106, #122
- #124 delete custom persona <- #122
- #125 Tone read server function <- #28, #29, #31, #34, #46
- #134 version list server functions <- #37, #82
- #139 plan chip in app header <- #45, #93, #98, #100
- #142 first-run welcome card <- #90, #140
- #143 dashboard empty state <- #90
- #147 landing plan cards <- #144, #146
### Wave 10
- 👤 #48 tune reaction and tone prompts <- #3, #29, #47
- #66 not-a-draft-in-Buffer banner <- #63, #64, #65
- #84 save as a new draft <- #83
- #91 import drafts panel <- #89, #90
- #108 editor selection tracking <- #86
- #113 local backup of unsynced text <- #86
- #114 two-tab edit conflict prompt <- #86
- #115 live character counter <- #38, #86
- #118 "Feeling stuck?" hint <- #86
- #120 post deleted or locked while open <- #86
- #132 schedule server function <- #55, #57, #65, #83
- #135 version history panel <- #63, #93, #134
- #141 delete post from dashboard row <- #90, #119
- #149 account settings page <- #77, #78, #148
### Wave 11
- #67 move back to draft button <- #55, #61, #66
- #87 save draft button + messages <- #63, #83, #84, #86
- #109 read aloud and hear selection <- #86, #103, #105, #107, #108
- #116 signed-out dialog keeps text <- #53, #72, #113
- #136 restore a version <- #86, #135
- #150 settings tab navigation <- #99, #149
### Wave 12
- #110 limit-reached prompt <- #93, #98, #103, #109
- #117 Cmd/Ctrl+S saves the draft <- #86, #87
- #121 speaking indicator <- #109
- #133 schedule dialog <- #86, #87, #132
### Wave 13
- #127 Get reaction button <- #47, #86, #98, #107, #110, #126
### Wave 14
- #128 reaction cards <- #23, #93, #127
- #129 Tone read card <- #86, #110, #125, #126, #127
- #131 review-cost note on Read aloud <- #109, #126, #127
