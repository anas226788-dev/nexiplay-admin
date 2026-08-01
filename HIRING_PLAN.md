# NexiPlay AI Organization Structure — Hiring Plan

This document defines the complete AI agent organization for NexiPlay across three divisions: **Web Platform**, **Native Android App**, and **Content + Social Media + Marketing**. Each role specifies title, responsibilities, scope, assigned model, reporting line, collaborators, permissions, and boundaries.

---

## Division 1: WEB PLATFORM

### 1.1 Platform Architect (Division Lead)

**Assigned Model:** `claude-3.5-sonnet` (Anthropic) — best for system design, architectural decisions, cross-cutting concerns, and technical leadership.

**Reports To:** CEO (you)

**Collaborates With:** All Web Platform leads, Android Division Lead, Content Division Lead

**Permissions & Access:**
- Full read/write to both Next.js codebases (admin + public)
- Supabase schema migration authority
- CI/CD pipeline configuration
- Infrastructure decisions (Vercel, Supabase, CDN)
- Code review approval for cross-cutting changes

**Boundaries (Must NOT Do):**
- Write feature-level code (delegates to specialists)
- Manage content operations or social media
- Directly configure Android build tooling

---

### 1.2 Senior Frontend Engineer — Admin Panel

**Assigned Model:** `gpt-4o` (OpenAI) — strong at React/Next.js, TypeScript, complex UI state, and component architecture.

**Reports To:** Platform Architect

**Collaborates With:** Backend Engineer, UI/UX Designer, QA Engineer

**Scope:**
- `nexiplay-admin-main/src/app/**` — all admin routes
- `nexiplay-admin-main/src/components/admin/**` — admin components
- Admin-specific hooks, libs, utilities
- Real-time features (Supabase Realtime)
- Data tables, forms, wizards, bulk actions

**Priorities:**
1. Admin dashboard performance & UX
2. Content management workflows (CRUD for movies, episodes, downloads, streaming)
3. Scraper configuration UI
4. Coin shop, leaderboard, notices, messages admin
5. Role-based access control in UI

**Permissions:** Read/write `nexiplay-admin-main/` only. No direct DB migrations.

**Boundaries:** No public-site code. No Supabase schema changes. No Android code.

---

### 1.3 Senior Frontend Engineer — Public Website

**Assigned Model:** `gpt-4o` (OpenAI) — same strengths, different codebase focus.

**Reports To:** Platform Architect

**Collaborates With:** Backend Engineer, SEO Specialist, UI/UX Designer, QA Engineer

**Scope:**
- `nexiplay-web-main/src/app/(site)/**` — all public routes
- `nexiplay-web-main/src/components/**` — shared/public components
- Watch pages, streaming player integration
- User auth flows (login, register, account, password reset)
- Novel reader, search, genre pages
- Sitemap generation, SEO meta tags, OG images

**Priorities:**
1. Core Web Vitals (LCP, INP, CLS)
2. Streaming player reliability across sources
3. Auth flow completeness & security
4. Novel reading experience
5. Mobile-responsive layouts

**Permissions:** Read/write `nexiplay-web-main/` only. No admin panel code. No DB migrations.

**Boundaries:** No admin panel features. No Supabase schema changes. No Android code.

---

### 1.4 Backend Engineer (Supabase & API)

**Assigned Model:** `claude-3.5-sonnet` (Anthropic) — excels at SQL, Postgres, RLS policies, Edge Functions, API design.

**Reports To:** Platform Architect

**Collaborates With:** Both Frontend Engineers, DevOps/Infra Engineer, Scraper Engineer

**Scope:**
- `supabase/migrations/**` — all schema changes
- `nexiplay-admin-main/src/app/api/**` — admin API routes
- `nexiplay-web-main/src/app/api/**` — public API routes
- Supabase Edge Functions (if adopted)
- RLS policies, indexes, stored procedures
- Real-time subscriptions design
- Auth hooks, webhooks

**Priorities:**
1. Schema evolution without downtime
2. RLS correctness for multi-tenant data
3. API contract stability (OpenAPI/TypeScript types)
4. Query performance (indexing, materialized views)
5. Cron job reliability (pg_cron / Supabase Cron)

**Permissions:** Full Supabase dashboard access. Write migrations. Deploy Edge Functions. No frontend component code.

**Boundaries:** No React component code. No UI/UX decisions. No Android backend.

---

### 1.5 Scraper & Automation Engineer

**Assigned Model:** `gpt-4o` (OpenAI) — strong at parsing, regex, cheerio, async orchestration, anti-bot strategies.

**Reports To:** Platform Architect

**Collaborates With:** Backend Engineer, Content Curator (Division 3), QA Engineer

**Scope:**
- `nexiplay-admin-main/src/app/api/scrape*.ts` — all scraper endpoints
- `nexiplay-admin-main/src/lib/scraper-utils.ts`
- Scraper configuration in `app_settings` (rareanimes, bollyflix, movielink, animerulz, toonplay)
- Cron jobs: `check-episodes`, `check-links`, `auto-match-streaming`
- Content request staging (`scraped_data`, `scraper_source`, `review` status)
- Rate limiting, proxy rotation, retry logic

**Priorities:**
1. Scraper resilience (selectors, pagination, error handling)
2. New source integration (config-driven)
3. Episode auto-discovery & matching
4. Dead link detection & auto-disable
5. Scraping ethics & legal compliance (robots.txt, rate limits)

**Permissions:** Write scraper endpoints & utils. Read `app_settings` & `movies`/`episodes`/`streaming`. No UI code. No auth changes.

**Boundaries:** No frontend components. No RLS policies. No user-facing features outside scraping.

---

### 1.6 DevOps & Infrastructure Engineer

**Assigned Model:** `claude-3.5-sonnet` (Anthropic) — strong at CI/CD, Docker, Vercel, Supabase, monitoring, security hardening.

**Reports To:** Platform Architect

**Collaborates With:** Backend Engineer, Both Frontend Engineers, Security Auditor

**Scope:**
- `vercel.json`, `next.config.mjs`, `package.json` scripts
- GitHub Actions / Vercel CI pipelines
- Supabase project config (branching, backups, PITR)
- Environment variable management (`.env.*`, secrets)
- Preview deployments, production promotions
- Logging, error tracking (Sentry), uptime monitoring
- Dependency updates, security scanning

**Priorities:**
1. Zero-downtime deployments
2. Preview environments per PR
3. Secrets hygiene (no keys in repo)
4. Build performance (turbopack, caching)
5. Disaster recovery (DB backups, rollback runbooks)

**Permissions:** Vercel & Supabase dashboard admin. CI/CD config. No application code changes.

**Boundaries:** No feature code. No schema design. No content decisions.

---

### 1.7 UI/UX Designer (Web)

**Assigned Model:** `gpt-4o` (OpenAI) — strong visual reasoning, component design systems, accessibility, design tokens.

**Reports To:** Platform Architect

**Collaborates With:** Both Frontend Engineers, Content Division (brand consistency)

**Scope:**
- Design system: colors, spacing, typography, components (Tailwind config)
- Figma/Sketch handoff (or design tokens in code)
- Admin panel usability audits
- Public site conversion optimization
- Accessibility (WCAG AA) compliance
- Dark mode, responsive breakpoints

**Priorities:**
1. Consistent component library across admin + public
2. Mobile-first streaming/watch experience
3. Admin workflow efficiency (fewer clicks)
4. Brand cohesion (logo, icons, illustrations)
5. Design token sync with Tailwind

**Permissions:** Read both frontends. Write `tailwind.config.js`, design tokens, component specs. No logic code.

**Boundaries:** No TypeScript/React logic. No backend/API decisions. No Android design.

---

### 1.8 QA & Test Engineer (Web)

**Assigned Model:** `gpt-4o-mini` (OpenAI) — cost-effective for test generation, Playwright scripts, regression suites.

**Reports To:** Platform Architect

**Collaborates With:** All Web Platform engineers

**Scope:**
- `nexiplay-admin-main/__tests__/**` (or `tests/`)
- `nexiplay-web-main/__tests__/**`
- Playwright E2E suites (auth, watch, admin CRUD, scraping)
- Unit/integration tests (Vitest/Jest)
- Visual regression (Chromatic or Percy)
- Performance budgets (Lighthouse CI)

**Priorities:**
1. Critical path coverage (auth → watch → download)
2. Scraper contract tests (mock sources)
3. Admin permission matrix tests
4. Mobile viewport regression
5. CI integration (block merge on failure)

**Permissions:** Write test files only. Read all source. No production code changes.

**Boundaries:** No feature implementation. No schema changes. No deploy config.

---

### 1.9 Security Auditor (Web)

**Assigned Model:** `claude-3.5-sonnet` (Anthropic) — best for threat modeling, OWASP, authZ/authN review, secrets detection.

**Reports To:** Platform Architect

**Collaborates With:** Backend Engineer, DevOps, CEO

**Scope:**
- Dependency vulnerability scanning (npm audit, Snyk)
- RLS policy audit (test matrices)
- API route authorization review
- XSS/CSRF surface analysis
- Content Security Policy tuning
- Pen-test coordination (external)
- Incident response playbooks

**Priorities:**
1. Zero critical CVEs in production deps
2. RLS coverage 100% on user-data tables
3. Admin route authZ verification
4. Secure headers & CSP
5. Secrets rotation schedule

**Permissions:** Read all code & infra. Write security docs, audit reports, CSP headers. No feature code.

**Boundaries:** No feature implementation. No schema migrations. No UI changes.

---

## Division 2: NATIVE ANDROID APP

### 2.1 Android Division Lead

**Assigned Model:** `claude-3.5-sonnet` (Anthropic) — architectural oversight, Kotlin/Multiplatform expertise, platform strategy.

**Reports To:** CEO

**Collaborates With:** Platform Architect (Web), Content Division Lead, All Android engineers

**Scope:**
- `android-app/` (new module/repo)
- Gradle build logic, CI/CD (GitHub Actions + Firebase App Distribution / Play Console)
- Architecture: Clean Architecture + MVI or MVVM + Flow
- Shared Kotlin Multiplatform (KMP) modules for data/models with Web (future)
- Release management (staged rollouts, feature flags)

**Priorities:**
1. Project bootstrap (AGP, KSP, Hilt, Compose, Room, Coil, ExoPlayer)
2. Offline-first sync with Supabase (Realtime + local cache)
3. Streaming player (Media3/ExoPlayer) with multi-source fallback
4. Push notifications (FCM) for new episodes, coins, messages
5. Play Store compliance (Data Safety, Target API, 64-bit)

**Permissions:** Full Android repo. Firebase/Play Console admin. Read Web APIs for contract alignment.

**Boundaries:** No Web frontend code. No Supabase schema changes (coordinates with Backend Engineer). No content operations.

---

### 2.2 Senior Android Engineer — Core & Streaming

**Assigned Model:** `gpt-4o` (OpenAI) — deep Kotlin, Compose, Media3/ExoPlayer, Coroutines/Flow.

**Reports To:** Android Division Lead

**Collaborates With:** Android UI Engineer, Backend Engineer (API contracts), QA Engineer

**Scope:**
- `android-app/app/src/main/java/.../core/**` — data layer, repository, network, database
- `android-app/app/src/main/java/.../player/**` — ExoPlayer wrapper, source resolver, DRM (if any)
- Offline download manager (WorkManager + Room + FileProvider)
- Background sync (Supabase Realtime → local DB)
- Analytics events (coin earn, watch time, errors)

**Priorities:**
1. Reliable multi-source streaming (animerulz, toonplay, direct)
2. Offline download with resume, quality selection, expiry
3. Background episode check & notification
4. Low-latency startup (cold start < 2s)
5. Crash-free rate > 99.5%

**Permissions:** Write core/player modules. Read API specs. No UI composables.

**Boundaries:** No UI/Compose code. No backend changes. No Play Console admin.

---

### 2.3 Senior Android Engineer — UI & Compose

**Assigned Model:** `gpt-4o` (OpenAI) — Jetpack Compose, Material3, animation, accessibility, performance.

**Reports To:** Android Division Lead

**Collaborates With:** Core Engineer, UI/UX Designer (Web), QA Engineer

**Scope:**
- `android-app/app/src/main/java/.../ui/**` — all Compose screens
- Navigation (Navigation Compose, deep links)
- Theming (Material3, dynamic color, dark mode)
- Lists (LazyColumn, Paging 3), grids, detail sheets
- Player overlay controls, gestures, PiP mode
- Onboarding, auth flows, settings, profile, coin shop

**Priorities:**
1. 60fps scrolling on low-end devices
2. Material3 + brand parity with Web
3. Accessibility (TalkBack, font scaling, contrast)
4. Deep link → correct screen (watch, novel, search)
5. Compose preview coverage for design system

**Permissions:** Write UI modules. Read core/player APIs. No data layer code.

**Boundaries:** No repository/network/DB code. No ExoPlayer internals. No backend.

---

### 2.4 Android QA & Release Engineer

**Assigned Model:** `gpt-4o-mini` (OpenAI) — test automation, Firebase Test Lab, Play Console automation.

**Reports To:** Android Division Lead

**Collaborates With:** Core Engineer, UI Engineer, DevOps (Web)

**Scope:**
- `android-app/app/src/androidTest/**` — Espresso/Compose UI tests
- `android-app/app/src/test/**` — Unit tests (Turbine, JUnit)
- Firebase Test Lab matrix (API levels, devices, locales)
- Play Console track management (internal → closed → open → production)
- Crashlytics / Play Vitals monitoring
- Automated screenshot comparison

**Priorities:**
1. Critical flow automation (auth → watch → download → offline)
2. Device farm coverage (10+ device configs)
3. Release checklist automation
4. Crash grouping & regression detection
5. Performance benchmarks (startup, frame timing)

**Permissions:** Write test code. CI/CD config for Android. Play Console release manager.

**Boundaries:** No production app code. No backend. No Web.

---

## Division 3: CONTENT + SOCIAL MEDIA + MARKETING

### 3.1 Content & Growth Division Lead

**Assigned Model:** `claude-3.5-sonnet` (Anthropic) — strategic thinking, content ops, cross-functional coordination, data-driven decisions.

**Reports To:** CEO

**Collaborates With:** Platform Architect, Android Division Lead, All Content agents

**Scope:**
- Content acquisition strategy (licensing, partnerships, UGC)
- Editorial calendar (anime seasons, movie releases, novel serials)
- SEO content strategy (blog, guides, watch-order lists)
- Social media presence (X/Twitter, YouTube, TikTok, Discord, Reddit)
- Community management & moderation
- Monetization optimization (coin economy, ad placement, premium tiers)
- Analytics & KPI dashboard (MAU, retention, ARPU, content velocity)

**Priorities:**
1. Content pipeline: request → scrape → review → publish → promote
2. Seasonal anime calendar automation
3. SEO traffic growth (target: 50% organic)
4. Community engagement (Discord events, watch parties)
5. Revenue diversification (ads, coins, subscriptions, affiliate)

**Permissions:** Read analytics (Supabase, Vercel, Play Console). Write content CMS (if built). Coordinate with Scraper Engineer. No code deployment.

**Boundaries:** No code changes. No schema migrations. No infra config.

---

### 3.2 Content Curator & Acquisitions Manager

**Assigned Model:** `gpt-4o` (OpenAI) — strong at classification, metadata enrichment, judgment calls, multilingual.

**Reports To:** Content & Growth Division Lead

**Collaborates With:** Scraper Engineer, SEO Specialist, Community Manager

**Scope:**
- Content request triage (`content_requests` table: review → added/rejected)
- Metadata enrichment (TMDB, MAL, AniList, TVDB IDs, genres, synopsis)
- Quality gates: poster art, streaming availability, episode completeness
- Duplicate detection & merge
- Licensing/partnership outreach (track in Notion/Airtable)
- Novel catalog curation (source attribution, chapter ordering)

**Priorities:**
1. Reduce request-to-publish latency (< 24h)
2. Metadata completeness > 95% (TMDB/MAL IDs, genres, year)
3. Seasonal anime slate ready 1 week before air date
4. Novel series continuity (no missing chapters)
5. Takedown/DMCA response < 4h

**Permissions:** Write `movies`, `episodes`, `streaming`, `categories`, `content_requests` via admin UI or direct SQL (reviewed). No code.

**Boundaries:** No code. No schema changes. No ad config. No social posting.

---

### 3.3 SEO & Technical Content Strategist

**Assigned Model:** `claude-3.5-sonnet` (Anthropic) — best for technical SEO, schema.org, content architecture, data-led strategy.

**Reports To:** Content & Growth Division Lead

**Collaborates With:** Public Frontend Engineer, Content Curator, Backend Engineer (sitemaps)

**Scope:**
- `nexiplay-web-main/src/app/sitemap*.xml.ts` — dynamic sitemaps
- `nexiplay-web-main/src/app/api/og-image/**` — dynamic OG images
- Schema.org markup (Movie, TVSeries, VideoObject, WebPage)
- Keyword research & content briefs (blog, guides, "how to watch X")
- Internal linking strategy (genre → content, watch → related)
- Core Web Vitals monitoring (Lighthouse CI)
- Indexation coverage (GSC, Bing Webmaster)

**Priorities:**
1. 100% valid schema.org on all watch/content pages
2. Sitemap freshness < 1h after publish
3. Blog/content hub for long-tail keywords
4. OG image generation for every shareable URL
5. Zero indexation errors in GSC

**Permissions:** Read public frontend. Write sitemap/OG routes. Propose schema changes to Backend. No admin code.

**Boundaries:** No admin panel code. No scraper logic. No social media posting.

---

### 3.4 Social Media & Community Manager

**Assigned Model:** `gpt-4o` (OpenAI) — strong copywriting, platform-native formats, trend awareness, multilingual.

**Reports To:** Content & Growth Division Lead

**Collaborates With:** Content Curator, SEO Strategist, Discord Moderators (human), Android Engineer (deep links)

**Scope:**
- X/Twitter: daily posts, thread announcements, engagement replies
- YouTube Shorts / TikTok / Reels: clip creation prompts, scheduling
- Discord: announcements, events, moderation escalation, bot commands
- Reddit: r/anime, r/movies, niche community participation
- Email/newsletter: weekly digest, new episode alerts
- UGC campaigns (fan art, watch-party screenshots, reviews)

**Priorities:**
1. Daily active presence on 3+ platforms
2. Episode drop → social post < 30 min
3. Discord engagement (polls, events, Q&A)
4. Referral/coin incentive campaigns
5. Crisis comms playbook (downtime, DMCA, bugs)

**Permissions:** Social account access (via buffer/later or native). Discord bot token. Deep link generator. No code.

**Boundaries:** No code. No DB writes. No scraper config. No ad management.

---

### 3.5 Monetization & Ads Operations Specialist

**Assigned Model:** `gpt-4o-mini` (OpenAI) — operational, data-oriented, A/B testing, revenue optimization.

**Reports To:** Content & Growth Division Lead

**Collaborates With:** Backend Engineer (coin/leaderboard logic), Admin Frontend Engineer (coin shop UI), Android Engineers (IAP)

**Scope:**
- `app_settings` ad config (popunder, direct link, frequency caps)
- Coin economy: earn rates, shop pricing, leaderboard rewards
- Ad network mediation (AdMob, Unity, custom direct)
- IAP products (Google Play Billing, coin packs, premium tier)
- Revenue reporting (daily/weekly/monthly dashboards)
- Fraud detection (click spam, bot traffic, coin farming)

**Priorities:**
1. Ad fill rate > 90%, eCPM optimization
2. Coin earn/balance ratio sustainable (inflation control)
3. IAP conversion funnel < 5% drop-off
4. Fraudulent accounts < 0.1% of active
5. Monthly revenue forecast accuracy ±10%

**Permissions:** Write `app_settings` (ads), `coin_shop_items`, `leaderboard_entries` (rewards). Read analytics. No code deployment.

**Boundaries:** No code changes. No schema migrations. No content decisions. No social posting.

---

### 3.6 Analytics & Growth Engineer (Data)

**Assigned Model:** `claude-3.5-sonnet` (Anthropic) — SQL, data modeling, dashboards, experimentation framework.

**Reports To:** Content & Growth Division Lead

**Collaborates With:** Backend Engineer (events schema), All Division Leads, Monetization Specialist

**Scope:**
- `user_events`, `coin_balances`, `profiles` — event schema design
- Supabase Realtime → analytics warehouse (Postgres → BigQuery/ClickHouse via Fivetran/Airbyte)
- Dashboards: Mixpanel/Amplitude/Metabase (retention, funnels, content performance)
- A/B test framework (feature flags, holdouts, statistical rigor)
- Cohort analysis (by acquisition channel, content type, platform)
- Alerting (DAU drop, crash spike, revenue anomaly)

**Priorities:**
1. Event schema consistency (snake_case, required fields)
2. Daily automated dashboards for all leads
3. Experiment velocity: 2+ tests/month
4. Data freshness < 15 min
5. PII compliance (no raw emails in analytics)

**Permissions:** Read all DB tables. Write analytics schema (separate schema). Deploy dashboards. No product code.

**Boundaries:** No product feature code. No UI. No scraper. No social.

---

## Cross-Cutting Roles

### X.1 Chief of Staff / Program Manager

**Assigned Model:** `gpt-4o` (OpenAI) — coordination, tracking, communication, dependency management.

**Reports To:** CEO

**Collaborates With:** All Division Leads

**Scope:**
- Sprint planning & retrospectives (bi-weekly)
- OKR tracking (quarterly)
- Cross-division dependency resolution
- Release train coordination (Web + Android simultaneous)
- Stakeholder updates (weekly summary)
- Risk register & mitigation

**Priorities:**
1. On-time delivery of committed scope
2. Zero surprise blockers (early escalation)
3. Clear decision logs (RFC/ADR)
4. Resource allocation visibility
5. Retrospective action items closed

**Permissions:** Read all repos, issues, PRs. Write project docs, sprint plans. No code.

**Boundaries:** No technical decisions. No code. No content.

---

### X.2 Technical Writer & Documentation Engineer

**Assigned Model:** `gpt-4o-mini` (OpenAI) — clear technical writing, OpenAPI, runbooks, onboarding.

**Reports To:** Platform Architect (dotted to Chief of Staff)

**Collaborates With:** All engineers

**Scope:**
- `docs/` — architecture, API reference, runbooks
- OpenAPI spec (generated from API routes)
- Onboarding guides (new agent/human)
- Incident postmortems template
- Changelog automation (conventional commits → CHANGELOG.md)

**Priorities:**
1. API docs always in sync with code
2. Runbook for every critical service (scraper, streaming, auth)
3. New contributor productive in < 2h
4. Postmortem published < 48h after incident

**Permissions:** Write `docs/`, OpenAPI config. Read all code. No logic changes.

**Boundaries:** No feature code. No schema. No product decisions.

---

## Model Assignment Rationale Summary

| Model | Roles Assigned | Why |
|-------|----------------|-----|
| `claude-3.5-sonnet` | Platform Architect, Backend Engineer, Android Division Lead, Security Auditor, SEO Strategist, Analytics Engineer, Chief of Staff | Best for architecture, SQL, system design, threat modeling, data strategy, coordination |
| `gpt-4o` | Senior Frontend (Admin), Senior Frontend (Public), Scraper Engineer, UI/UX Designer, Core Android, UI Android, Content Curator, Social Media Manager, Monetization Specialist, Technical Writer | Strong at React/Next.js, Kotlin/Compose, parsing, copywriting, judgment, multilingual |
| `gpt-4o-mini` | QA Engineer (Web), Android QA, Monetization Ops (support), Technical Writer (support) | Cost-effective for test generation, operational tasks, high-volume low-complexity |

---

## Reporting Structure (Text Diagram)

```
CEO
├── Platform Architect (Web Division Lead)
│   ├── Senior Frontend Engineer — Admin
│   ├── Senior Frontend Engineer — Public
│   ├── Backend Engineer (Supabase/API)
│   ├── Scraper & Automation Engineer
│   ├── DevOps & Infrastructure Engineer
│   ├── UI/UX Designer (Web)
│   ├── QA & Test Engineer (Web)
│   └── Security Auditor (Web)
├── Android Division Lead
│   ├── Senior Android Engineer — Core & Streaming
│   ├── Senior Android Engineer — UI & Compose
│   └── Android QA & Release Engineer
├── Content & Growth Division Lead
│   ├── Content Curator & Acquisitions Manager
│   ├── SEO & Technical Content Strategist
│   ├── Social Media & Community Manager
│   ├── Monetization & Ads Operations Specialist
│   └── Analytics & Growth Engineer
├── Chief of Staff / Program Manager
└── Technical Writer & Documentation Engineer
```

---

## Permissions Matrix (Summary)

| Role | Admin Frontend | Public Frontend | Supabase Schema | Supabase Data | Android Repo | CI/CD/Infra | Social Accounts | Analytics/Ads |
|------|----------------|-----------------|-----------------|---------------|--------------|-------------|-----------------|---------------|
| Platform Architect | RW | RW | Approve | Read | Read | RW | - | Read |
| Frontend Admin | RW | - | - | Read | - | - | - | - |
| Frontend Public | - | RW | - | Read | - | - | - | - |
| Backend Engineer | - | - | RW | RW | - | Read | - | Read |
| Scraper Engineer | R (api) | - | - | RW (scrape tables) | - | - | - | - |
| DevOps | - | - | - | - | - | RW | - | - |
| UI/UX Designer | R | R | - | - | - | - | - | - |
| QA Web | R | R | - | - | - | Read (CI) | - | - |
| Security Auditor | R | R | R (audit) | R (audit) | R (audit) | R (audit) | - | - |
| Android Lead | - | - | Coord | Read | RW | RW (Android) | - | Read |
| Android Core | - | - | - | Read (API) | RW (core) | - | - | - |
| Android UI | - | - | - | - | RW (ui) | - | - | - |
| Android QA | - | - | - | - | RW (test) | RW (Android CI) | - | - |
| Content Lead | - | - | - | Read | - | - | Coord | RW (dashboards) |
| Content Curator | - | - | - | RW (content) | - | - | - | - |
| SEO Strategist | - | R (sitemap) | Propose | Read | - | - | - | Read (GSC) |
| Social Manager | - | - | - | - | - | - | RW | - |
| Monetization | - | - | - | RW (ads/coins) | - | - | - | RW |
| Analytics Engineer | - | - | RW (analytics schema) | R | - | - | - | RW |
| Chief of Staff | R | R | R | R | R | R | R | R |
| Tech Writer | R | R | R | - | R | R | - | - |

RW = Read/Write, R = Read only, Coord = Coordinate/Propose, - = No access

---

## Hiring Sequence (Phased)

**Phase 1 (Week 1-2): Foundation**
1. Platform Architect
2. Backend Engineer
3. DevOps & Infrastructure Engineer
4. Chief of Staff

**Phase 2 (Week 3-4): Web Feature Velocity**
5. Senior Frontend Engineer — Admin
6. Senior Frontend Engineer — Public
7. Scraper & Automation Engineer
8. UI/UX Designer
9. QA & Test Engineer
10. Security Auditor

**Phase 3 (Week 5-8): Android Bootstrap**
11. Android Division Lead
12. Senior Android Engineer — Core
13. Senior Android Engineer — UI
14. Android QA & Release Engineer

**Phase 4 (Week 5-12, parallel): Content & Growth**
15. Content & Growth Division Lead
16. Content Curator
17. SEO Strategist
18. Social Media Manager
19. Monetization Specialist
20. Analytics Engineer

**Phase 5 (Ongoing): Enablement**
21. Technical Writer

---

## Acceptance Criteria for This Plan

- [ ] All 21 roles defined with complete template sections
- [ ] Model assignments justified against actual available models
- [ ] Reporting lines form a clear DAG (no cycles)
- [ ] Permissions matrix covers all sensitive surfaces
- [ ] Boundaries prevent scope creep and conflicts
- [ ] Phased hiring sequence respects dependencies
- [ ] Cross-division collaboration paths explicit
- [ ] Document saved as `HIRING_PLAN.md` in repo root

---

*End of Hiring Plan*