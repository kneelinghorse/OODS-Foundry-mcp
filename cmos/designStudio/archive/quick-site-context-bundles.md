# Quick-Site Context Bundles (Marketing & Blog)

Captured: 2025-11-08

This note translates rapid inspiration research into machine-readable context bundles that can be handed to the MCP orchestrator. Each bundle marries qualitative intent (personas, narrative, IA) with quantitative constraints (tokens, component mappings) so quick builds never leave the guardrails of the OODS design system.

---

## Reference Capture Template

Use this structure every time you scout a new lightweight site (marketing page, blog, minisite).

| Field | Description |
| --- | --- |
| `Inspiration ID` | Short handle (e.g., `linear-core`, `vercel-ai`, `notion-blog`). |
| `URL + Snapshot` | Canonical URL plus note of screenshot + full-page PDF stored in `/artifacts/research/<id>/`. |
| `Type` | Site archetype (SaaS marketing, infrastructure landing, editorial/blog, etc.). |
| `Primary Personas & JTBD` | 1–3 personas with verbs (e.g., "Head of Platform → validate vendor trust"). |
| `North-Star Story` | 2–3 sentence summary of the promise and proof pattern. |
| `IA / Section Order` | Ordered list describing hero → proof → CTA, including approximate viewport heights. |
| `Component Map` | Table linking observed sections to existing MCP components (and noting gaps to backfill). |
| `Token & Style Translation` | Color, type, spacing extracted from live CSS mapped to OODS tokens (or backlog items). |
| `Data/API Hooks` | Any live data (metrics, logos, blog feed) plus how to source it internally. |
| `Capture Assets` | Screenshots, SVGs, fonts, and scraped HTML/CSS references with timestamps. |
| `Context Bundle JSON` | The trimmed payload to feed the mission (persona summary + ia tree + allowed components). |
| `Prompt Stub` | Suggested mission or MCP request that cites the context bundle + MCP component endpoints. |

---

## Reference Bundles

### 1. `linear-core` — Linear.app Core SaaS Landing

**Snapshot**

- URL: https://linear.app (captured 2025-11-08, desktop 1440 px)
- Type: AI-native B2B SaaS landing
- Why it matters: Best-in-class dark theme showcasing dense UI previews, crisp typography, and credibility stack for engineering buyers.

**Personas & JTBD**

- `VP Engineering / Head of Product`: See a focused workflow aid that respects craft and speed.
- `Staff Designer`: Evaluate whether the system has opinionated, high-contrast patterns that keep UI consistent.
- `Founder / Buyer`: Scan proof (logos, testimonials, product screenshots) without reading walls of copy.

**Narrative & IA**

1. Hero (`HeroStack + InlineCTA`): Centered headline, supporting copy, dual CTA, subtle gradient background (`#08090a → #141516`), and product motion embed.
2. Proof bar (`LogoMarquee`): Greyscale logos (Contrast ratio ~4.5 on near-black) just below the fold.
3. Feature pairings (`SplitPanel`, `TabbedFeatureRail`): Alternating dark cards with product UI stills and bullet microcopy.
4. Workflow deep dive (`Timeline + StatTiles`): Stepper explaining plan-build-ship with metrics.
5. Social proof (`QuoteTile`, `AvatarList`).
6. Pricing preview + footer CTA (`PlanMatrix`, `CommandBarCTA`).

**Component Mapping (Observed → OODS)**

| Section | Observed Pattern | OODS Component Analog | Notes / Gaps |
| --- | --- | --- | --- |
| Hero | Vertical stack, blur gradient, pill CTA secondary | `Hero.Orchestrator` + `PillCTA` | Need light-on-dark gradient tokens ready. |
| Proof Bar | Auto-scrolling logos | `Marquee.LogoStrip` | Provide prop for monochrome logos. |
| Feature Rail | Tabbed panel with screenshot swap | `Tabs.Panel + MediaFrame` | Hook screenshot asset references via `@/media`. |
| Workflow | Numbered timeline with stats | `Timeline.Progressive + StatList` | Add optional glow border token. |
| Testimonial | Quote with avatar + metadata | `Testimonial.Card` | Already exists; ensure dark theme variant. |
| Pricing | Simple tier list + CTA | `Pricing.Simple` | Offer toggle for "Start building" vs. "View docs". |

**Token Translation (from `/_next/static/chunks/dcf1dd31fdc81c28.css`)**

| Linear Token | Value | Map to OODS | Action |
| --- | --- | --- | --- |
| `--color-bg-primary` | `#08090a` | `color.surface.900` | Exists (dark base). |
| `--color-bg-tertiary` | `#232326` | `color.surface.700` | Ensure alias for section cards. |
| `--color-text-primary` | `#f7f8f8` | `color.text.inverse` | Align typography tokens. |
| `--color-link-primary` | `#828fff` | `color.accent.500` | Add violet accent variant. |
| `--radius-24` | `24px` | `radius.xl` | Already present. |
| `--page-max-width` | `1024px` | `layout.page.max` | Mirror for quick template. |

**Data/API Hooks**

- Logo belt: Use existing `partners.json` reference; include grayscale flag to auto-tint.
- Product stills: Capture PNG + WebM for hero; store in `artifacts/research/linear` with metadata for orchestrator.
- Metrics: Pull from `diagnostics.json` or brand narrative (ship velocity, issue closure time) to keep CTA credible.

**Asset Capture Checklist**

- Full-page PNG + annotated PDF.
- Individual hero motion (WebM) and 3 static UI stills.
- CSS snippet saved as `/artifacts/research/linear/tokens-linear.css`.
- Color palette JSON for quick import into MCP token endpoint.

**Prompt Stub**

```json
{
  "mission": "Site.QuickCompose",
  "context_bundle": "research/linear-core.json",
  "requirements": [
    "Use Hero.Orchestrator with dark-surface tokens",
    "Assemble Marquee.LogoStrip + Tabs.Panel + Timeline.Progressive stack",
    "Load screenshots from media://linear-core/"
  ]
}
```

---

### 2. `vercel-ai` — Vercel AI Platform Landing

**Snapshot**

- URL: https://vercel.com/ai (captured 2025-11-08 via marketing root)
- Type: Infrastructure / platform marketing with heavy motion and editorial storytelling.
- Why it matters: Demonstrates monochrome minimalism, dense badge/tile treatments, and live code examples that we can mirror with MCP-constrained components.

**Personas & JTBD**

- `Head of Platform / CTO`: Confirm enterprise readiness (security, compliance, scale).
- `Founding Engineer`: Scan DX improvements (SDKs, templates, docs).
- `Marketing Lead`: Borrow hero/story pacing for campaign microsites.

**Narrative & IA**

1. Hero: Left-aligned headline, supporting copy, stacked CTAs (Deploy + Docs) with animated glassmorphism background.
2. Logo marquee + customer cards (Runway, Zapier, etc.).
3. Feature grid mixing badges, pill buttons, and code sample chips.
4. Story band describing workflow (Design → Build → Ship) with alternating imagery.
5. Resource rail linking to docs, templates, blog.
6. Final CTA with gradient button + trust badges.

**Component Mapping**

| Section | Observed Pattern | OODS Analog | Notes |
| --- | --- | --- | --- |
| Hero | Left text + floating gradient canvas | `Hero.Split` + `GlassPanel` overlay | Need prop for animated background asset. |
| Badge grid | Color-coded badges stacked in grid | `BadgeGrid` | Accepts semantic color tokens (blue, pink, green). |
| Feature cards | Mixed content (code, metrics) | `Card.Composite` | Provide slot for monospace code snippet. |
| Story band | Alternating split sections | `SplitPanel.Sequence` | Already used in enterprise site. |
| Resource rail | 3-up tiles with arrow CTA | `List.FeaturedLinks` | Add `surface.transparent` option. |

**Token Translation (from `/_next/static/chunks/baee071755cd6056.css`)**

| Observed Token | Value | Suggested OODS Map |
| --- | --- | --- |
| Primary background | `#000000` | `color.surface.1000` |
| Foreground | `#ffffff` | `color.text.inverse` |
| Accent (brand blue) | `#0070f3` | `color.accent.brand` |
| Accent (magenta) | `#f81ce5` | `color.accent.alt` |
| Accent (teal) | `#00ffe0` | `color.accent.success` (glow) |
| Neutral border | `#404040` | `color.border.inverse` |

Action items: expose a `mono.glass` surface token (rgba white 0.08) and a `grid-debug` token for optional layout overlays (mirrors `--debug-guide-color` in CSS).

**Data/API Hooks**

- Customer marquee: Leverage existing `case-study` data; map to `LogoMarquee` component.
- Code samples: Pull from MCP `context_enrichment` output to ensure syntax-highlighting matches `@geist` theme.
- Resource cards: Query docs/blog feed via `contexts/index.json`.

**Assets**

- Capture hero background SVG + noise texture.
- Save the hashed CSS chunk as `/artifacts/research/vercel/tokens-vercel.css`.
- Screenshot each badge color to help QA the token mapping.

**Prompt Stub**

```json
{
  "mission": "Site.QuickCompose",
  "context_bundle": "research/vercel-ai.json",
  "requirements": [
    "Use Hero.Split (text left) + GlassPanel asset vercel/glass.png",
    "Chain BadgeGrid → Card.Composite (3 cols) → SplitPanel.Sequence (2 items)",
    "Expose two CTAs (Deploy, Docs) and a resource rail of 3 cards"
  ]
}
```

---

### 3. `notion-editorial` — Notion Product / Blog Hybrid

**Snapshot**

- URL: https://www.notion.com/product (captures editorial blog treatments)
- Type: Editorial / content marketing with warm neutrals.
- Why it matters: Illustrates how a content-heavy page balances serif headlines, soft neutrals, and modular article cards—ideal for quick blog or knowledge-base spins.

**Personas & JTBD**

- `Content Lead`: Needs flexible hero + article rail to launch campaigns fast.
- `Knowledge Manager`: Wants to reuse layout for changelog or release notes.
- `Prosumer Creator`: Evaluates templates and tutorials visually before reading.

**Narrative & IA**

1. Hero with serif headline, subcopy, CTA, and overlapping illustrations.
2. Feature slices (workspace, wiki, docs) each with supporting copy & screenshot.
3. Editorial rail of recent stories (cards with tags, reading time).
4. Template gallery grid with filters/chips.
5. Global CTA + trust band.

**Component Mapping**

| Section | Observed Pattern | OODS Analog | Notes |
| --- | --- | --- | --- |
| Hero | Soft beige background, serif headline | `Hero.Muted` | Ensure serif token available. |
| Feature slices | Split layout with accent pill tags | `SplitPanel + PillList` | Need `pill.soft` token. |
| Editorial rail | Card list with metadata | `Card.Article` | Already supports tag + time. |
| Template grid | Filter chips + cards | `Filter.Tabs` + `Card.Template` | Hook to taxonomy data source. |
| CTA band | Centered text + ghost button | `CTA.Stacked` | Use light surface tokens. |

**Token Translation (from `/_next/static/css/0b07506584e923af.css`)**

| Notion Token | Value | Suggested OODS Map | Action |
| --- | --- | --- | --- |
| `--color-gray-100` | `#fcfbfb` | `color.surface.sand.50` | Add sand palette alias. |
| `--color-gray-400` | `#a39e98` | `color.text.muted` | Map to neutral-500. |
| `--color-blue-500` | `#097fe8` | `color.accent.info` | Already present; confirm contrast. |
| `--text-color-dark` | `#111111` | `color.text.primary` | No change. |
| `--font-family-serif` | `Lyon Text` stack | `font.family.serif` | Ensure available in tokens build. |

Spacing: Notion hero uses ~112 px top/bottom padding and 960 px max width. Mirror with `layout.page.max=960` for editorial templates.

**Data/API Hooks**

- Editorial rail: connect to `domains/blog/index.json` (if absent, scaffold feed importer).
- Template cards: tie into `contexts/templates.json`.
- Tag chips: reuse taxonomy tokens from `docs/domains`.

**Assets**

- Capture hero illustration PNG (transparent) + accent icons.
- Save CSS chunk to `/artifacts/research/notion/tokens-notion.css`.
- Export 3 article card screenshots for visual QA.

**Prompt Stub**

```json
{
  "mission": "Site.QuickCompose",
  "context_bundle": "research/notion-editorial.json",
  "requirements": [
    "Use Hero.Muted with serif typography token",
    "Stack SplitPanel (3) → Card.Article rail → Card.Template grid",
    "Add CTA.Stacked footer referencing templates feed"
  ]
}
```

---

## Next Actions

1. **Materialize Bundles** — Convert the above summaries into JSON payloads (`research/<id>.json`) that list personas, IA tree, required components, and referenced asset paths so the MCP agent can hydrate context automatically.
2. **Asset Storage** — Drop screenshots, CSS snippets, and palette JSON in `/artifacts/research/<id>/` with the naming convention `YYYYMMDD_<asset>.{png,json}`. Reference those paths inside the bundles.
3. **Token Backlog** — File backlog items for any missing aliases noted above (violet accent, glass surface, sand palette) so the MCP component server can return them as first-class tokens.
4. **Mission Wiring** — Extend the `Site.QuickCompose` mission spec so it accepts `context_bundle` IDs, fetches the JSON, and calls `GET /components`, `GET /tokens` from the MCP server before orchestrating layouts.
