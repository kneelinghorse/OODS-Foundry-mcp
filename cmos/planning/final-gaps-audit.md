Where the Gaps Are (Potential Additions)
Based on the research and what I see missing:

No mapping/onboarding tool — If OODS is middleware, someone needs a way to say "my Material Button = OODS Actionable + Themeable." There's no map.create or similar tool. This is the generalization gap you identified.

A11y is on-demand, not in the governance loop — repl.validate checks schema structure but doesn't flag "this color combination fails WCAG AA." Could it? Making accessibility part of validation (not a separate scan) would be a strong differentiator.

No composition/generation tool — Agents can discover and validate, but there's no design.compose that takes "I need a dashboard with metrics and a sidebar" and returns a valid schema. The Workbench does this via LLM, but the MCP itself doesn't.

Code export from validated schemas — repl.render produces HTML. But what about React? Vue? The catalog has Code Connect snippets, but there's no code.generate tool that takes a validated schema and outputs framework-specific code.

Versioned structured data — ETag caching exists, but can an agent request "give me the components as of version X"? Token versioning was flagged in the TraceLab research as important.


**Updated Gap List (Engineering)**
Combining the research findings with the earlier audit:

Gap	What It Adds	Priority for Article?
A11y in the validation loop	repl.validate flags WCAG issues before render, not as a separate scan	High — strengthens the governance story
Composition/generation tool	design.compose — agent describes intent, gets a valid schema back	Medium — future roadmap, not needed for article
Code export from schemas	code.generate — validated schema → React/Vue/HTML	Medium — nice to have, catalog already has Code Connect
Mapping/onboarding tool	map.create — relate your existing components to OODS traits	Lower — generalization story, longer-term
Versioned structured data	Agent can request "components as of version X"	Lower — ETag caching covers the basics
The a11y-in-validation-loop is the one that would strengthen the article most. If repl.validate could flag "this StatusChip color combination fails WCAG AA contrast" alongside "QuickActions isn't a valid component," that takes governed rendering from structural governance to accessibility governance. That's a differentiator nobody would expect.


notes from work, sprint 50:
css-modules styling option is defined in schema but not yet producing output