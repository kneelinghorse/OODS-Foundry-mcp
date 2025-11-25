# Semantic Protocol v3.2.0

`src/system_protocols/Semantic Protocol — v3.2.0.js` implements the final semantic protocol engine with self-enriching manifests, protocol bindings, and catalog discovery.

## Highlights

- Self-enriching manifests: sets `version=3.2.0`, generates URNs when missing, and infers `element.intent`, `element.criticality`, `semantics.precision.confidence`, and a 64-dim semantic vector from purpose/description text.
- Rich bindings: normalises `context.protocolBindings.*` entries (requires/provides arrays) and includes bindings, intent, and governance in the signature used for diffing.
- Suite helpers: `validate`, `query`, `diff`, `generateDocs`, and `set` mirror the rest of the protocol suite ergonomics.

## API surface

```js
import { createSemanticProtocol, createSemanticCatalog } from '@/system_protocols/Semantic Protocol — v3.2.0.js';

const checkout = createSemanticProtocol({
  id: 'checkout.form',
  element: { type: 'ui.form' },
  semantics: { purpose: 'Collect checkout payment details' },
  metadata: { description: 'Captures billing address and payment instrument' }
});

checkout.validate();               // runs built-ins: core.shape, bindings.urns, bindings.contracts
checkout.query('element.intent=Create');
const docs = checkout.generateDocs();
```

Built-in validators:
- `core.shape` — requires a valid URN and `element.type`
- `bindings.urns` — enforces URN formatting on binding entries
- `bindings.contracts` — enforces URNs inside `requires` / `provides` arrays

`diff` returns `changes` plus `significant` entries when bindings or intent shift; signatures include intent, governance, and bindings.

## Catalog discovery

```js
const catalog = createSemanticCatalog([checkout, otherProtocol]);
const related = catalog.discoverRelationships(0.4); // cosine similarity over semantic vectors
```

Catalog items expose `items()` and `find(predicate)` for ad hoc queries; relationships surface URN pairs that clear the similarity threshold.

## Runtime bridge

`src/system_protocols/runtime-protocol-bridge.js` registers protocols for runtime use and exposes React hooks:
- `register()` stores a protocol and indexes by component name when present.
- `ProtocolViewProvider` / `useProtocol()` supply context-aware metadata (intent, criticality, governance, bindings) and helper utilities (`validate`, `getContextClasses`, `shouldShowLoadingState`).
- `discoverRelationships()` on the registry delegates to the semantic catalog when vectors exist.
