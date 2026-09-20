# Handoff: finish Jason Dicken's AI portfolio page

You are Opus 5, taking over a portfolio page for Jason Dicken. Jason is a 25-year restaurant operator who builds the software his businesses run on, and he is applying for **AI prompt engineer** and **AI app builder / AI solutions** roles. A recruiter review of the current page found it strong on story and weak on proof. Your job is to add the proof.

## Where things are

- **The page:** published as a private artifact at https://claude.ai/artifact/Sztw53E7Nk23cJdy2Pk3vw. Read it with the Artifact tool (`action: "read"`), edit the HTML, republish with `url` set to that address so the link stays the same. It is a single self-contained HTML file with no doctype/head/body of its own (the artifact skeleton adds those), CSS tokens on `:root` with dark-mode blocks, Google Fonts (Bricolage Grotesque, Source Sans 3, JetBrains Mono). Keep all of that.
- **The plan:** https://claude.ai/code/artifact/e01bac95-8b1f-4018-b5ea-8f7805e00bf8 (a Claude doc). Read it first. It holds the project inventory, ranked next projects, resume bullets and the 4-week plan.
- **Evals repo:** `C:\Users\jason\dev\cobblestone-ai-evals` (private GitHub). Multi-agent baton lock: read `CLAUDE.md` and `BATON.md`; do not edit that repo unless you hold the baton. You only need to *read* from it (prompts/v1.md, evals/results/*.json, evals/REPORT.md, cases.jsonl).
- **CRM repo:** github.com/jasondickenrealty-lang/cobblestone-crm (private, FastAPI). Jason edits it in VS Code over the VPS. Read-only for you unless Jason says otherwise. <!-- scan:allow -->

## Rules that do not bend

1. **No invented numbers.** Every figure on the page traces to a run file, a database query, or something Jason states. If you don't have it, leave a clearly marked `[NEEDS: …]` placeholder and ask.
2. **No real customer, employee or business-partner data.** Names, emails, phones and companies in any example conversation are fictional. Jason's own contact details are the only real ones.
3. **Do not quote the archived 65%.** The first support-assistant run was graded by a judge that was later found wrong; that run is archived. Use only results produced under judge version 2.
4. **Keep the design.** Same tokens, fonts, spacing system and components (`.meta`, `.ticket`, `.tier`, `.detail`, `.card`). Add components in the same voice. Do not restyle.
5. **Ask before publishing anything the CRM repo would expose** (prompts, schemas). Scrub secrets and internal URLs.

## What the recruiter review found

Ranked by how much it costs Jason in a 60-second recruiter scan.

| # | Problem | Why it matters | Fix (step below) |
|---|---|---|---|
| 1 | Nothing on the page is clickable: no GitHub, no live site, no LinkedIn, no resume | Claims with no links read as unverified | Step 2 |
| 2 | A prompt-engineering portfolio shows zero prompts | The single thing a prompt-engineer hiring manager looks for | Step 3 |
| 3 | Case study 01 has no result yet ("re-run next") | A case study without a number is a plan, not a case study | Step 4 |
| 4 | Case study 02 has architecture but no production numbers | "In daily use" needs runs/month, cost/month, statements processed | Step 4 |
| 5 | No screenshots or example conversations for the CRM or POS agent | App-builder roles want to see the thing running | Steps 5–6 |
| 6 | The "how I build with AI agents" story (baton protocol, decision logs) is one sentence | It is Jason's strongest AI-app-builder signal and it's buried | Step 7 |
| 7 | Contact is an email button only | Recruiters go to LinkedIn first | Step 2 |
| 8 | Page lives at a claude.ai artifact URL | A personal domain reads as permanent and professional | Step 9 |
| 9 | Orchestrator system prompt says "sixteen specialist agents"; code has 18 | Anyone who opens the repo will find it | Step 3 (Jason fixes in repo; you reflect it) |

## Steps

Work in this order. After each step, republish the artifact and tell Jason in one line what changed.

### Step 1 — Read, then collect inputs from Jason

Read the page and the plan. Then ask Jason for the following in **one** message, as a checklist he can answer in one reply. Do not start editing until you have at least the links.

- Public URLs: evals repo (once public), LinkedIn, Owner's Notebook site, cobblestonepos.com (if he wants it linked)
- Resume as PDF (or say you'll build it from the plan's resume bullets)
- Which email goes on the page (current: jasondickenrealty@gmail.com) <!-- scan:allow -->
- Screenshots, scrubbed of real names: CRM dashboard, an Oreo chat, the PendingAction approval screen, a statement-extraction result, the POS agent answering a question, Galley's approval flow
- Production numbers from the CRM `agent_runs` table for the last 30 days: total runs, runs by agent, total cost, cost by model tier. Ask him to run the query and paste the output.
- Merchant statements processed to date, and the yearly cost of the SaaS subscription the vision extraction replaced
- Confirmation that v1 has been re-run under judge v2, and whether v2 exists yet
- The orchestrator's system prompt (after he fixes "sixteen" → 18), with anything sensitive removed
- One real-but-scrubbed `ask_agent` thread showing a `needs` list, and one POS-agent Q&A

### Step 2 — Links and contact

- Header: add GitHub, LinkedIn and Resume links to the nav.
- Hero: keep the headline. Under the fact chips, add one line: "Open to remote prompt engineering and AI solutions roles · Evansville, Indiana" — Jason confirms wording.
- Contact section: email button stays; add LinkedIn and GitHub as secondary links; add "Download resume (PDF)". Since artifact viewers cannot download from `<a download>`, link to the PDF hosted on GitHub or the deployed site (Step 9).
- Every project card and case study gets a "Repo" or "Live" link where one exists. Private repos: say "private — walkthrough on request" rather than linking nothing.

### Step 3 — Show the prompts

Case study 01:
- Add a block "The prompts, as written". Show `prompts/v1.md` verbatim in a `<pre>` (mono, scrollable, both themes). Above it, two sentences on what a reader should notice (the friendly tone, the one-line hand-off rule, no instruction about unknowns — which is exactly what failed).
- When v2 exists: show v2 beside v1 as a diff-style pair, and the header comment naming which case ids it targets.
- Show the judge rubric for one case (sup-25, the milk-allergy case) and the grounding rule added in judge v2. Add the judge-agreement rate once Jason has hand-graded a sample.

Case study 02:
- Add a block "What the orchestrator is told". Show an excerpt (not the whole thing) of the orchestrator system prompt after Jason's fix, with the routing rules and the send-gate language visible. Annotate three lines in the margin: why the specialists have no DB access, why `needs` exists, why the send gate is described in code terms.
- Show one `run_agent_skill` output schema (lead score) as a short JSON example.

Use a consistent annotated-prompt component: prompt in a `<pre>`, annotations as a numbered list beside or below it. Build it once, reuse it.

### Step 4 — Put real numbers on the page

Case study 01, once results under judge v2 exist:
- Replace the "Status" meta cell with the result: "v1 X/40 → v2 Y/40".
- Add a results table by category × version, computed from `evals/results/*.json` (never from memory). Add the fixed / still failing / regressed list from REPORT.md.
- Add a simple bar chart (inline SVG, theme tokens, labels on every bar) of pass rate by version. Load the `dataviz` skill before drawing it.
- Add tokens-per-case and cost per 1,000 conversations from the run file's `usage` block and public per-token pricing; state the pricing date.

Case study 02, from the `agent_runs` query Jason pastes:
- Add a "By the numbers, last 30 days" strip using the `.meta` grid: runs, cost, cost per run, share of runs on Haiku vs Opus, statements processed, subscription replaced ($/yr).
- Add a source line under it: "From the CRM's agent_runs table, queried <date>."

Case study on the POS agent (if Jason wants it promoted): only with a recorded eval run.

### Step 5 — Screenshots

- Add a `<figure>` component: image, one-line caption saying what to look at. Max two per case study. Convert images to WebP, embed as data URIs, keep the page under 4 MB total.
- Prefer the PendingAction approval screen over a dashboard overview — it proves the send gate is real.
- Scrub or blur any real name before embedding. Check the image yourself.

### Step 6 — Example conversations

Reuse the `.ticket` component from case study 01.
- Case study 02: one `ask_agent` thread — request, specialist's `needs` list, orchestrator's fetch, final answer, then the PendingAction row awaiting approval.
- POS agent card: one Q&A — an owner's question, the agent's answer, and the query it ran (if the agent exposes it). If the agent has ever refused or said "I don't have that data", show that one; it is worth more than a correct answer.
- Fictional names only.

### Step 7 — "How I build" section

New section between Shipped work and In progress. Three short blocks:
- **Spec first.** Written handoff docs and a locked decision log per project (Galley's decisions are in the plan doc; cite two).
- **One writer at a time.** The baton protocol from the evals repo: link `CLAUDE.md` and `BATON.md` once the repo is public; quote the `take` / `pass` / `steal` commands.
- **Prompts are code.** The 16-vs-18 drift as the example: what it was, how it was found, what now checks it (if Jason adds a test, name it).

### Step 8 — Copy pass

- Six-second test: read only the headline, chips, section headings and meta cells. A recruiter should be able to say what Jason does, what he built, and that he measures it. Adjust headings until that is true.
- Remove any sentence that cannot be backed by a link, a number or a screenshot on the page.
- Keep Jason's voice: short sentences, operator's vocabulary, no "leveraged", no "passionate".
- Check that "18 specialists" appears consistently and matches the chip count.

### Step 9 — Own domain

- Produce a full-document version (`index.html` with doctype, `<head>`, meta description, Open Graph title/description/image, favicon) alongside the artifact version.
- Deploy to GitHub Pages or Vercel. Suggest `jasondicken.com` or a subdomain of a domain Jason already owns; Jason decides.
- Keep republishing the artifact too, so both stay in sync until the domain is live. Then the artifact page gets a one-line banner linking to the domain.

### Step 10 — QA before you say it is done

- Phone width (400px): no horizontal scroll, tables scroll inside their own container.
- Dark mode: every color comes from a token; screenshots have a border so they don't float on dark ground.
- Every link resolves. Every number has a source line. No `[NEEDS: …]` left.
- Privacy: grep the HTML for `@`, phone patterns, and any real business names other than Jason's own brands.
- Send Jason a screenshot of the full page at desktop and phone width.

## Definition of done

- [ ] GitHub, LinkedIn, resume PDF and at least one live site linked
- [ ] At least three prompts shown verbatim with annotations (v1, judge rubric, orchestrator excerpt)
- [ ] Case study 01 shows v1 → v2 numbers from run files under judge v2
- [ ] Case study 02 shows 30-day production numbers with a source line
- [ ] Two scrubbed screenshots and two example conversations on the page
- [ ] "How I build" section live
- [ ] Deployed on a domain Jason owns, artifact still republishing
- [ ] QA list above passed; Jason has seen desktop and phone screenshots

## Do not

- Do not add a blog, testimonials, a skills-percentage bar, a photo carousel, or animation.
- Do not write "AI-powered" anywhere. Say what the model does.
- Do not touch the evals or CRM repos without the baton / Jason's say-so.
- Do not create a new artifact; republish the existing URL.
