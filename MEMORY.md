# Memory

- Sprint 90 write-side loop is live: `map.apply`, `registry.snapshot`, paginated `map.list`, and the 8-surface registration audit all landed. See `cmos/planning/roadmap-v1.md`.
- Real emitted Stage1 integration evidence is captured in `cmos/reports/s90-m06-stage1-reconciliation-transcript-2026-04-16.json`.
- Operational caveat: `cmos_message` is still failing at the tool layer in this environment, so the Stage1 info-push handshake is pending that recovery.
