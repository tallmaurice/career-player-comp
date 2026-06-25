# Career Player Comp — Build Spec (original)

> **NOTE:** This is the original build spec as drafted. `memory/build_state.md` holds the LOCKED DECISIONS and ADJUSTMENTS that **override this document wherever they conflict** — most importantly: model is **Claude Sonnet 4.6** (not Haiku), the share card is rendered **server-side** (satori/OG-style, not html2canvas), the name is **Career Player Comp** (not "NBA Career Comp"), donation copy is an honest tip, quiz has back-navigation, rate limiting uses a KV store plus a global daily spend cap, and both native share + PNG download ship. Read build_state.md first.

---

Build a web app called "Career Player Comp" — a tool that takes a user's career history and quiz answers, runs them through Claude AI, and outputs a personalized NBA player comparison with a shareable card.

## STACK
- Next.js (App Router) — DECIDED (flipped from the spec's original Vite, per build_state.md): server-side card-image generation and the Claude API proxy are first-class in Next, and the card must be pixel-perfect
- Tailwind CSS v4
- pdf.js (CDN) for LinkedIn PDF text extraction
- Claude API via a Vercel Edge Function proxy (model per build_state.md: Sonnet 4.6)
- Card PNG export (per build_state.md: server-side generation, not html2canvas)
- Stripe Payment Link (external URL) for donation — no Stripe SDK needed
- Deploy target: Vercel

## DESIGN DIRECTION

The aesthetic is a vintage NBA scouting report crossed with NBA 2K player screen UI. Think ESPN The Magazine meets a front office whiteboard. Dark surfaces with warm court-wood accents. Strong typography. Clean, intentional, nothing decorative for its own sake.

Color palette:
- Background: #0f0e0c (near-black, warm)
- Surface: #1a1815
- Surface elevated: #242220
- Border: rgba(255,255,255,0.08)
- Primary accent: #c8a84b (court gold)
- Text primary: #f0ece4
- Text muted: #8a8680
- Text faint: #4a4844
- Badge colors by category:
  - Scoring badges: #e06c3a (burnt orange)
  - Defense badges: #4a7fa5 (steel blue)
  - Playmaking badges: #5a9e6f (court green)
  - Culture/intangible badges: #c8a84b (gold)

Typography:
- Display font: "Barlow Condensed" (Google Fonts, weights 600 and 700) — for player names, archetype titles, large headings
- Body font: "Inter" (Google Fonts, weights 400 and 500) — for all body text, quiz questions, UI copy

No purple. No gradients on interactive elements. No colored side borders on cards. No icons in colored circles. No emoji as design elements. No AI-aesthetic decoration.

All writing in the UI must sound like a knowledgeable human wrote it. Short, direct sentences. No em dashes. No filler phrases. No "delve," "dive deep," "unlock," "empower," "seamlessly," or any AI writing tropes.

## SCREEN FLOW

A single React SPA with smooth transitions:
1. Landing
2. Career Upload
3. Quiz (8 screens, one question per screen)
4. Optional Text Inputs (2 screens, both skippable)
5. Scouting Room (loading)
6. Results

### SCREEN 1: LANDING
Full-screen dark layout, center-aligned.
- Logo — "CAREER PLAYER COMP" in Barlow Condensed, all caps, gold accent.
- Tagline: "Find out which NBA player your career makes you."
- Sub-line (muted): "Upload your LinkedIn. Answer 8 questions. Get your scouting report."
- A preview of an example result card (static, pre-designed, real player e.g. "Andre Iguodala" with fake stat line and badges) so users see what they're getting.
- CTA: "Start My Scouting Report" — full-width on mobile, centered desktop, gold bg, dark text, border radius ≤ 6px.
- Footer line (small, muted): "Runs on AI. No account needed. No data stored."
- No feature lists, no testimonials in v1.

### SCREEN 2: CAREER UPLOAD
Header: "First, let's pull your career film." Sub: "The more we have, the more accurate your comp."
Two options, equal visual weight, BOTH framed to elicit CLEAN career data (per build_state.md — do not claim paste is easier, and never invite a whole-page dump):
- OPTION A — Upload a résumé or LinkedIn export. Accept a résumé PDF (often the cleanest, most on-point career doc) OR a LinkedIn "Save to PDF" export. How-to toggle for LinkedIn: "Your profile → More → Save to PDF." File upload, PDF only, shows filename on success.
- OPTION B — Paste your work history. Textarea, placeholder: "e.g. Senior Electrician, Turner Construction, 2018–present. Crew Lead, Apex Builders, 2012–2018..." Explicit guard in the UI: paste titles, companies, and years (or résumé text) only — do NOT paste your whole LinkedIn page. If the paste is very long or looks like a full page, warn the user to trim to work history.
After selecting, a "Continue to Questions" button appears.
PDF text extraction via pdf.js; pass extracted text to Claude. The system prompt must pull Experience + Education (+ the user's paragraph) and IGNORE résumé/LinkedIn cruft (featured posts, recommendations, "people also viewed," activity, contact info). If extraction returns < 50 chars, surface the paste path.

### SCREENS 3–10: QUIZ (one question per screen)
Layout: question centered, large (Barlow Condensed). Answer options as full-width tappable cards with subtle border. On tap: card highlights gold, auto-advances after 150ms. Progress: 8 dots up top (completed = gold, current pulses). Transition: slide out left / in right, 200ms ease. **Add back-navigation (per build_state.md) so a mis-tap can be changed.** Skip button only on the two optional text screens ("Skip — let the film speak").

THE 8 QUESTIONS: (NOTE: several drafted options below use em dashes — Q4, Q5, Q7, and the Q9 prompt — replace them with commas or colons per the no-em-dash rule when building. Also keep the loading-screen player count in sync with the final pool size, or make it era-flavored.)

Q1: "A problem lands with no owner and no instructions. What actually happens?"
- I take it and figure it out
- I find who should own it and hand it off
- I wait to see if someone else grabs it
- I fix what I can and flag the rest
- I ask questions until the picture is clear

Q2: "Where do people rely on you most?"
- When everything is falling apart
- When someone new needs to learn the ropes
- When nobody else will take the job
- When a deadline is about to get missed
- When the energy in the room needs fixing

Q3: "Your job hits a rough stretch. Where are you in that story?"
- Front and center, helping fix it
- Head down, just doing my job
- Watching and planning my next move
- Holding the team together
- Figuring out if it's time to go

Q4: "Someone around you is not pulling their weight. You:"
- Say something directly
- Tell someone above them
- Cover for them quietly
- Try to help them get better
- Stay out of it — not my problem

Q5: "How long before you mentally own a new environment?"
- Immediately — I walk in ready
- A few weeks once I see how it works
- A few months once I've proven myself
- A year or more — I earn it slowly
- I let results speak before I claim anything

Q6: "You get passed over for something you wanted. Two days later:"
- Already working on what comes next
- Still frustrated but processing it
- Using it as fuel
- Questioning if this is the right place
- Mostly over it — on to the next thing

Q7: "The version of you that made it in 10 years looks like:"
- Running something — a team, a company, an operation
- Being the best at one specific thing
- Finally getting the recognition I've always deserved
- Having built something of my own
- Still here, still doing it — that's the win

Q8: "Pick the role that fits you most naturally:"
- The one making the calls
- The one making sure the calls get executed
- The one everyone brings their problems to
- The one who does what nobody else will
- The one who makes everyone around them better

SCREEN 9 (Optional text — Q9): "One thing about how you work that people around you know — but nobody ever says out loud." Textarea 2–3 lines. Placeholder: "Be honest. This is between you and the scout." Skip visible.

SCREEN 10 (Optional text — Q10): "Upgrade your scouting report. (Optional)" Sub: "Paste a recent accomplishment, a performance review note, or just describe what you actually do that doesn't show up on a resume." Textarea 4–5 lines. Placeholder: "The scout reads everything." Skip visible. After: "Submit to the Front Office" button.

### SCREEN 11: SCOUTING ROOM (LOADING)
Full screen, dark. Small CSS-animated spinning basketball (not a GIF). Below it, a monospace line cycling with a typewriter effect (type in, pause 1.5s, fade, next):
"Pulling career film..." / "Scanning 150+ player profiles..." / "Cross-referencing hustle metrics..." / "Consulting the front office..." / "Reviewing locker room tendencies..." / "Checking playoff performance..." / "Analyzing contract history..." / "Finalizing your scouting report..."
Minimum 3s loading shown even if faster. If >20s or error: "The front office is backed up. Try submitting again." with retry; log the error.

### SCREEN 12: RESULTS
Two-panel on desktop (card left, details right); single column on mobile (card top, details below).

SHARE CARD COMPONENT (the exportable piece): looks like a real scouting card. Dark surface (#1a1815), gold accent border (1px, full perimeter), subtle low-opacity hardwood texture (CSS pattern). Contents top to bottom:
- Header bar: "CAREER PLAYER COMP — SCOUTING REPORT" (tiny, tracked, muted)
- Player name (Barlow Condensed 700, large, dominant)
- Position + Era (small, muted, e.g. "Small Forward · 2000s–2020s")
- Archetype title (Barlow Condensed 600, medium, e.g. "The Silent Architect") — coined fresh per user, never generic
- Gold divider (low opacity)
- Badges (4–6 pills, color-coded by category, 2K-style: dark pill, category-colored text + subtle border)
- Scouting report (Inter 14px, 2–3 sentences, must reference specifics from the user's real career)
- Divider
- Stat line in monospace, 4 columns: [XX SEASONS] [X TEAMS] [X PIVOTS] [CONTRACT STATUS]
- Front office fit (small, italic, muted, e.g. "Best suited for: Championship contender")
- Site URL watermark bottom right (faint): careerplayercomp.com

BELOW THE CARD: native Share button (Web Share API) AND two download buttons — "Download Card" (16:9 PNG) and "Download for Stories" (9:16 PNG). (Card images generated server-side per build_state.md.)
Then the donation line (honest tip framing per build_state.md): "This runs on AI credits. If your comp was accurate, help keep the scouting department open." + a tip link (Stripe Payment Link, new tab, no modal/form).
Then: "Think the scout got it wrong? Appeal Your Report" — returns to Screen 1 and clears all state.

## CLAUDE API INTEGRATION
Model: Claude Sonnet 4.6 (per build_state.md). Enable prompt caching on the system prompt + player JSON (static; cache_control: ephemeral). Call from a Vercel Edge Function (/api/generate-comp); never expose the key client-side.

REQUEST PAYLOAD to Claude:
- system: [FULL SYSTEM PROMPT below]
- messages: one user message containing CAREER DATA (extracted PDF text or pasted text) + QUIZ ANSWERS Q1–Q8 + OPTIONAL Q9/Q10 ("Not provided" if skipped)
- max_tokens: 800

EXPECTED OUTPUT — valid JSON:
{
  "player_name": "string",
  "position_era": "string",
  "archetype_title": "string (3–5 words, coined)",
  "badges": ["string", ...] (4–6 from master list),
  "badge_categories": { "badgeName": "scoring|defense|playmaking|culture" },
  "scouting_report": "string (2–3 sentences, references real career specifics)",
  "stat_line": { "seasons": "string", "teams": "string", "pivots": "string", "contract_status": "string" },
  "front_office_fit": "string",
  "comp_tone": "string"
}

Client/server validation: if player_name not in playerPool.json, reject and retry once with a note: "Your previous response assigned a player not in the approved list. Please select only from the provided player pool." Also retry once on invalid JSON.

## SYSTEM PROMPT FOR CLAUDE
You are a veteran NBA front office scout. You have reviewed thousands of careers across every industry — hospitals, construction sites, office towers, warehouses, kitchens, military units, and boardrooms. You find the basketball truth in all of them.

You are given a career profile and must assign one NBA player from the approved player pool below. Then generate a scouting report.

APPROVED PLAYER POOL: [INSERT FULL PLAYER JSON — 150+ players]

MASTER BADGE LIST: Floor General, Defensive Stopper, Limitless Range, Clutch Performer, Shot Creator, Glass Cleaner, Ankle Breaker, Playmaker, Post Scorer, Lockdown Defender, Lob City Finisher, Mid-Range Maestro, 3-Point Specialist, Paint Enforcer, High IQ Operator, Two-Way Force, Team Glue, Franchise Cornerstone, Late-Career Sage, System Destroyer, Bench Spark, Transition Threat, Motor Never Stops, Contract Year Mode, Locker Room Anchor, First Option, Sixth Man, Closer, Rim Protector, Facilitator, Defensive Anchor, Energy Specialist, Culture Carrier, Inside-Out Threat, Perimeter Lockdown, Secondary Scorer, Catch-and-Shoot Specialist, Screen Setter

RULES:
1. Only assign players from the approved pool. Never invent a player name.
2. The scouting_report MUST reference specific details from their actual career — industry, job titles, number of roles, tenure length, or something from their written paragraph. If it could apply to anyone else, rewrite it.
3. Blue-collar and trade careers (healthcare, construction, service, military, labor, logistics) are analyzed with the same depth and respect as executive careers. Never default to generic role-player comps for non-office careers. Find the player whose career pattern actually mirrors theirs.
4. The archetype_title must be coined for this specific person. Do not reuse titles. It should feel like it could only belong to them.
5. Negative or humbling comps (journeyman, role players, specialists) are valid and valuable. Frame all comps with dignity — resilience, mastery, reliability, elite specificity. Per build_state.md tone dial: witty, snarky, can sting a bit, but accuracy and the real-career-to-real-player parallel come first; it must feel undeniably accurate, and the sting must read as earned truth, never an insult. Never frame a comp as pure failure.
6. Tone: Direct, specific, confident, occasionally dry. The scout notices one particular thing others miss. No em dashes. No filler. No corporate language. Write like a human who knows basketball.
7. stat_line mapping: seasons = total years of work experience (estimate); teams = number of employers; pivots = career direction/industry changes; contract_status = Rookie Deal (0–3 yrs) | Rising Contract (4–8 yrs) | Mid-Level Exception (9–15 yrs) | Max Contract (15–25 yrs, senior) | Veteran Minimum (25+ yrs any level, framed as rare longevity).
8. Output valid JSON only. No text outside the JSON block.

## PLAYER JSON FILE
Create src/data/playerPool.json with 150+ players. Per-player schema:
{
  "name": "string",
  "position_era": "string",
  "career_archetypes": ["string"],
  "career_traits": ["string"],
  "work_style": "string (one sentence — how they operated)",
  "ambition_type": "string",
  "2k_label": "string",
  "comp_tone": "string"
}
(Per build_state.md, this is the moat: target ~200–250 players (deeper than 150), spanning ALL eras (1960s–present) with MANY deep cuts, curated for full CAREER-ARCHETYPE COVERAGE so every user maps cleanly. Include WNBA legends, assignable to ANY user regardless of gender. Each player needs a RICH, ACCURATE work_style/traits; accuracy-check the deep cuts since the model can be wrong on obscure names (Maurice QAs as domain backstop). DEDUPE: the distribution below double-lists some players, e.g. Jokic.)

Distribution (~150):
- 20 modern stars (LeBron, Curry, Giannis, KD, Luka, Jokic, Tatum, Ja Morant, Zion, Devin Booker, Jaylen Brown, Bam Adebayo, De'Aaron Fox, Paolo Banchero, Victor Wembanyama, Tyrese Haliburton, Shai Gilgeous-Alexander, Anthony Edwards, Cade Cunningham, Franz Wagner)
- 25 elite role players/specialists (Andre Iguodala, Draymond Green, PJ Tucker, Nicolas Batum, Derrick White, Kyle Lowry, Al Horford, Marcus Smart, Jrue Holiday, Patrick Beverley, Tony Allen, Bruce Bowen, Shane Battier, Thabo Sefolosha, Luol Deng, Trevor Ariza, Danny Green, George Hill, Patty Mills, Joe Harris, Brook Lopez, Naz Reid, Bobby Portis, Derrick Jones Jr., Precious Achiuwa)
- 20 blue-collar legends (Ben Wallace, Dennis Rodman, Udonis Haslem, PJ Brown, Bo Outlaw, Brian Scalabrine, Brian Cardinal, Reggie Evans, DeAndre Jordan, Bismack Biyombo, Kendrick Perkins, Perrin Buford, Jarvis Hayes, Ryan Bowen, Brendan Haywood, Joel Anthony, Chris Andersen, DJ Mbenga, Damian Jones, JaVale McGee early career)
- 15 clutch specialists/role heroes (Robert Horry, John Paxson, Steve Kerr, Mario Chalmers, J.R. Smith, Metta World Peace, Derek Fisher, Brent Barry, Brian Shaw, Vinnie Johnson, Byron Scott, John Starks, Muggsy Bogues, Vlade Divac, Horace Grant)
- 15 franchise cornerstones (Tim Duncan, Dirk Nowitzki, Kobe Bryant, Shaquille O'Neal, Hakeem Olajuwon, David Robinson, John Stockton, Karl Malone, Charles Barkley, Patrick Ewing, Reggie Miller, Gary Payton, Alonzo Mourning, Manu Ginobili, Tony Parker)
- 15 legends/icons (Michael Jordan, Magic Johnson, Larry Bird, Isiah Thomas, Oscar Robertson, Wilt Chamberlain, Bill Russell, Julius Erving, Kareem Abdul-Jabbar, Jerry West, Elgin Baylor, Walt Frazier, Dave Cowens, Bob Cousy, Pete Maravich)
- 15 misunderstood/late bloomers (Scottie Pippen, Kawhi Leonard, Jimmy Butler, Paul George, Pau Gasol, Chris Bosh, Rajon Rondo, Russell Westbrook, Carmelo Anthony late career, Vince Carter late career, Tracy McGrady injury arc, Grant Hill injury arc, Penny Hardaway, Brandon Roy, Yao Ming)
- 10 journeymen/survivors (Chucky Brown, Joe Smith, Vin Baker, Darius Miles, Stromile Swift, Quentin Richardson, Damon Stoudamire, Danny Fortson, Mike James, Eric Dampier)
- 15 wildcards (Steve Nash, Allen Iverson, Kevin Garnett, Ray Allen, Chauncey Billups, Ben Gordon, Gilbert Arenas, Amar'e Stoudemire, Dwight Howard, Blake Griffin, Chris Paul, Kyrie Irving, James Harden, Damian Lillard) — dedupe against above
- ~12 WNBA legends, assignable to ANY user (Diana Taurasi, Sue Bird, Maya Moore, Lisa Leslie, Sheryl Swoopes, Tamika Catchings, Sylvia Fowles, Candace Parker, Becky Hammon, Lauren Jackson, Cynthia Cooper, A'ja Wilson)
- ~40–50 ADDITIONAL deep cuts + older eras to reach ~200–250 and fill archetype gaps (e.g. Charles Oakley, Anthony Mason, Dale Davis, Jason Collins, Mark Madsen, Kurt Rambis, Bill Laimbeer, Rick Mahorn, Dennis Johnson, Michael Cooper, Bobby Jones, Paul Silas, Wes Unseld, Bill Walton, Maurice Cheeks, Mark Eaton, Ben Wallace-era role guys, etc.) — characterize each for its specific career archetype, accuracy-checked

## PROJECT FILE STRUCTURE
career-player-comp/ (reconcile with the Vite-vs-Next architecture call in build_state.md)
- index.html
- src/ (main.jsx, App.jsx, screens/{Landing,CareerUpload,Quiz,ScoutingRoom,Results}.jsx, components/{ScoutCard,BadgePill,StatLine,ProgressDots}.jsx, data/playerPool.json, lib/{pdfExtract.js,generateComp.js}, styles/index.css)
- api/generate-comp.js (server/edge proxy)
- .env.example, vercel.json, package.json

## STATE MANAGEMENT
React useState + useContext (no Redux/Zustand for v1). Global state: { careerText, quizAnswers (0–7 MC, 8–9 optional text), result | null, screen }. Clear all state on "Appeal Your Report".

## MOBILE REQUIREMENTS
Mobile-first at 375px; test 390px and 768px. Touch targets ≥ 44x44px. Quiz cards large enough to tap. Result card fully visible without horizontal scroll at 375px. Download/share buttons fit side by side at 375px. Loading screen must not overflow.

## DONATION INTEGRATION
No Stripe SDK. Stripe Payment Link (preset $2, one-time, "Keep the Scouting Dept Open"). URL in env VITE_STRIPE_DONATION_URL. Render a plain link, target _blank, rel noopener noreferrer. (Per build_state.md: button copy is an honest tip, not "Buy a Credit.")

## ENVIRONMENT VARIABLES
ANTHROPIC_API_KEY (server-side only) / VITE_STRIPE_DONATION_URL (Stripe Payment Link)

## LAUNCH CHECKLIST
- [ ] Output validation: player_name exists in playerPool.json
- [ ] Retry once on invalid JSON or out-of-pool player
- [ ] Timeout handling: 20s max, friendly error
- [ ] PDF fallback: < 50 chars → prompt paste
- [ ] Rate limiting: per-IP via KV store (≈5/IP/hr) PLUS a global daily spend kill-switch (build_state.md)
- [ ] Meta/OG tags: og:image (static example card), og:title "Career Player Comp — What player are you?", og:description
- [ ] Mobile: verify all screens at 375px
- [ ] No console errors on production build

## THINGS TO NOT DO
No em dashes in UI copy. No colored side borders. No gradient backgrounds on buttons. No icons in colored circles. No purple/violet. No "seamlessly/dive deep/unlock/empower/leverage/elevate" or similar. No account creation or email capture. No data stored beyond the API call lifecycle. No pre-written player descriptions — Claude writes every scouting report fresh.
