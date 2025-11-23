# AI Agent Instructions for DesignLab

## Project Overview

DesignLab is an AI-driven design orchestration platform that bridges UX research and production-ready design outputs using the OODS design system.

**Core Philosophy**: Research-informed design with intelligent constraints. We don't generate unconstrained designs; we synthesize research insights into OODS-compliant patterns.

## Project Architecture

```
UX Research Inputs (screenshots, sites, problems)
         ↓
Mission Protocol (UX research orchestration)
         ↓
Design Brief Synthesis
         ↓
AI Pattern Matching (OODS-aware)
         ↓
Figma Output (production-ready, compliant)
```

## Key Components

1. **Mission Protocol** - Used for UX research, competitive analysis, domain research (NOT for design prompting)
2. **OODS-Foundry** - Enterprise design system with trait-based components, 4-layer tokens, Figma integration
3. **MCP Integration Layer** - Connects AI agents to OODS components and Figma
4. **TraceLab Integration** - UX research repository for lineage/sources (separate project)
5. **CMOS** - Project management and mission orchestration

## Design Principles (from Research R0.01-R0.08)

### Core Insights
- **Intelligent Constraints > Blank Slate Prompting** - AI should assemble pre-approved components, not generate from scratch
- **Context Engineering > Prompt Engineering** - Quality comes from machine-readable design system, not prompt sophistication
- **Workflow Integration > Tool Features** - 95% of AI projects fail due to workflow friction, not tech limitations
- **Agentic AI > Generative AI** - Autonomous decision-making within constraints prevents governance debt

### The "Fidelity Gap" Risk
Avoid generating unconstrained code/designs. Always:
1. Start with OODS component library
2. Map design intent to existing patterns
3. Only extend system when clear gap exists
4. Maintain 100% design system compliance

## Working with OODS-Foundry

### Available Capabilities
- 4-layer token system (semantic tokens with governance)
- Trait-based component library (Statusables, Forms, Tables, Navigation, etc.)
- Multi-brand theming (brand switcher, dark mode, high-contrast)
- Figma Dev Mode integration with roundtrip sync
- WCAG 2.1 AA compliance enforcement
- Brownfield adoption (4-phase incremental integration)

### Component Selection Strategy
When presented with design requirements:
1. Analyze user needs and interaction patterns
2. Query OODS component library for matching traits
3. Select closest semantic match (not visual match)
4. Compose from existing components when possible
5. Flag genuine gaps (don't assume they exist)

## Working with Mission Protocol

### Appropriate Use Cases
- UX research synthesis
- Competitive analysis
- Domain/demographic research
- Industry landscape analysis
- Pattern identification from examples

### NOT Appropriate For
- Design prompt generation (consider standalone design app instead)
- Unconstrained ideation (conflicts with intelligent constraints approach)
- Code generation (use component mapping instead)

## Semantic Protocols (src/protocols/)

11 versioned protocol definitions provide machine-readable contracts:
- Semantic Protocol v3.2.0 (base URN-based manifests)
- API, Data, Event, Workflow Protocols v1.1.1
- UI Component, Agent, Analytics Protocols v1.1.1
- Identity, Integration, Documentation Protocols v1.1.1

Use these to maintain system interoperability and version control.

## CMOS Workflow

### Mission Types
1. **Research Missions** (R0.XX) - Landscape analysis, tool evaluation
2. **Evaluation Missions** (E1.XX) - Exploratory prototyping, integration tests
3. **Build Missions** (B1.XX) - Feature development, system implementation

### Session Management
- Track decisions in mission notes
- Export research findings to cmos/research/
- Use CLI for mission status updates
- Validate after each session: `./cmos/cli.py validate health`

### Research Export Process
When completing research missions:
```bash
./cmos/cli.py research export <mission-id>
# Archive to cmos/research/
```

## Development Guidelines

### File Organization
- **Application code**: Project root (NOT in cmos/)
- **CMOS artifacts**: cmos/ directory (tracking, research, scripts)
- **Protocols**: src/protocols/ (semantic definitions)
- **Documentation**: docs/ (architecture, roadmap, guides)

### Don't Over-Engineer
- Start by wiring existing pieces together
- Identify actual gaps through prototyping
- Avoid assuming what's needed
- Build lightweight, test, iterate

### Integration-First Approach
When building new capabilities:
1. Research what exists (OODS, Figma MCP, Mission Protocol)
2. Test integration points with minimal code
3. Identify genuine gaps (not assumed needs)
4. Build only what's necessary
5. Document learnings in CMOS research

## Success Metrics (from Enterprise Case Studies)

Target outcomes based on R0.01-R0.05 research:
- Research synthesis: 96% time reduction (3-4 days → <1 hour)
- Design iteration: Manual → conversational refinement
- Component compliance: 100% OODS adherence
- Design-to-code: Weeks → minutes
- ROI: 577% (Adobe Firefly benchmark)

## Communication Style

- Concise, technical, objective
- No emojis unless explicitly requested
- Focus on facts and problem-solving
- Challenge assumptions respectfully
- Prioritize truth over validation

## Current Phase: Foundation & Evaluation

We're in Sprint 01 focusing on:
- Evaluating OODS-MCP integration paths
- Testing design brief → OODS pattern mapping
- Researching Figma MCP server capabilities
- End-to-end wire testing (no new engineering)
- Identifying actual vs assumed gaps

## Questions to Ask

When unclear about direction:
1. Is this a research task (Mission Protocol) or design task (potential standalone app)?
2. Does this pattern exist in OODS already?
3. Are we over-engineering or building what's actually needed?
4. What's the minimal viable test to validate this assumption?
5. How does this fit into the research → brief → OODS → Figma flow?

## References

- Research artifacts: cmos/research/R0.01-R0.08
- OODS documentation: OODS_Foundry-all-docs-repomix.xml
- Technical vision: technical_vision.md
- CMOS user manual: cmos/docs/user-manual.md
- Protocol definitions: src/protocols/
