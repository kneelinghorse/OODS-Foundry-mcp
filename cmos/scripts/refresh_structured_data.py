#!/usr/bin/env python3
"""Refresh OODS structured data exports (components, traits, objects, tokens).

Outputs (defaults):
- cmos/planning/oods-components.json
- cmos/planning/oods-tokens.json
- cmos/planning/structured-data-delta-YYYY-MM-DD.md
- artifacts/structured-data/code-connect.json (when --artifact-dir is provided)
- artifacts/structured-data/manifest.json (when --artifact-dir is provided)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Set, Tuple

import yaml
from jsonschema import validate


# Resolve paths relative to repo root (cmos/scripts/* → repo root at parents[2])
REPO_ROOT = Path(__file__).resolve().parents[2]
CMOS_ROOT = REPO_ROOT / "cmos"
OUTPUT_DIR = CMOS_ROOT / "planning"
COMPONENT_SCHEMA_PATH = OUTPUT_DIR / "component-schema.json"
MANIFEST_SCHEMA_PATH = OUTPUT_DIR / "structured-data-manifest-schema.json"
DEFAULT_BASELINE_COMPONENTS_PATH = OUTPUT_DIR / "oods-components.json"
DEFAULT_BASELINE_TOKENS_PATH = OUTPUT_DIR / "oods-tokens.json"
LEGACY_BASELINE_COMPONENTS_PATH = CMOS_ROOT / "research" / "oods-components.json"
LEGACY_BASELINE_TOKENS_PATH = CMOS_ROOT / "research" / "oods-tokens.json"
ARTIFACT_DIR = REPO_ROOT / "artifacts" / "structured-data"


@dataclass
class ExtractedArtifact:
    name: str
    path: Path
    etag: str
    size_bytes: int


@dataclass
class RefreshResult:
    components: ExtractedArtifact
    tokens: ExtractedArtifact
    code_connect: Optional[ExtractedArtifact] = None
    delta_path: Optional[Path] = None
    manifest_path: Optional[Path] = None


VIZ_COMPLEXITY_WEIGHTS: Dict[str, int] = {
    "viz.scale": 1,
    "viz.encoding": 2,
    "viz.mark": 2,
    "viz.spatial": 3,
    "viz.layout": 3,
    "viz.interaction": 3,
}

BASIC_COMPONENT_DEFINITIONS: Tuple[Dict[str, Any], ...] = (
    {
        "id": "Button",
        "tags": ["action", "interactive", "primitive"],
        "contexts": ["detail", "form", "list"],
        "regions": ["actions", "main"],
    },
    {
        "id": "Card",
        "tags": ["container", "primitive", "surface"],
        "contexts": ["card", "detail", "list"],
        "regions": ["card", "main"],
    },
    {
        "id": "Stack",
        "tags": ["layout", "primitive", "structure"],
        "contexts": ["card", "detail", "form", "list", "timeline"],
        "regions": ["card", "contextPanel", "detail", "form", "list", "main", "timeline"],
    },
    {
        "id": "Text",
        "tags": ["content", "primitive", "typography"],
        "contexts": ["card", "detail", "form", "list", "timeline"],
        "regions": ["card", "contextPanel", "detail", "form", "list", "main", "timeline"],
    },
    {
        "id": "Input",
        "tags": ["field", "form", "primitive"],
        "contexts": ["form"],
        "regions": ["form", "main"],
    },
    {
        "id": "Select",
        "tags": ["field", "form", "primitive"],
        "contexts": ["form"],
        "regions": ["form", "main"],
    },
    {
        "id": "Badge",
        "tags": ["badge", "primitive", "status"],
        "contexts": ["card", "detail", "list"],
        "regions": ["card", "contextPanel", "detail", "list", "main"],
    },
    {
        "id": "Banner",
        "tags": ["feedback", "notice", "primitive"],
        "contexts": ["detail", "form", "list"],
        "regions": ["contextPanel", "detail", "form", "list", "main"],
    },
    {
        "id": "Table",
        "tags": ["data", "primitive", "table"],
        "contexts": ["detail", "list"],
        "regions": ["detail", "list", "main"],
    },
    {
        "id": "Tabs",
        "tags": ["navigation", "primitive", "tabs"],
        "contexts": ["detail", "form"],
        "regions": ["detail", "form", "main"],
    },
)


def iso_now() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_yaml(path: Path) -> Dict[str, Any]:
    def _sanitize(value: Any) -> Any:
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, dict):
            return {k: _sanitize(v) for k, v in value.items()}
        if isinstance(value, list):
            return [_sanitize(v) for v in value]
        return value

    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return _sanitize(raw)


def normalize_trait_name(name: str) -> str:
    return name.split("/")[-1]


def count_tokens(node: Any) -> int:
    if isinstance(node, dict):
        if "$value" in node:
            return 1
        return sum(count_tokens(value) for value in node.values())
    if isinstance(node, list):
        return sum(count_tokens(value) for value in node)
    return 0


def compute_render_complexity(categories: Set[str]) -> Optional[Dict[str, Any]]:
    viz_categories = sorted({category for category in categories if category.startswith("viz.")})
    if not viz_categories:
        return None
    score = sum(VIZ_COMPLEXITY_WEIGHTS.get(category, 2) for category in viz_categories)
    if score <= 2:
        tier = "low"
    elif score <= 5:
        tier = "medium"
    else:
        tier = "high"
    return {
        "tier": tier,
        "score": score,
        "categories": viz_categories,
        "source": "traitCategories",
    }


def collect_traits() -> tuple[
    List[Dict[str, Any]],
    Dict[str, Dict[str, Any]],
    Dict[str, Set[str]],
    List[Dict[str, Any]],
]:
    trait_paths: List[Path] = []
    trait_paths.extend((REPO_ROOT / "traits").glob("**/*.trait.yaml"))
    trait_paths.extend((REPO_ROOT / "domains").glob("*/traits/*.trait.yaml"))
    traits: List[Dict[str, Any]] = []
    components_index: Dict[str, Dict[str, Any]] = {}
    domain_traits: Dict[str, Set[str]] = defaultdict(set)
    trait_overlays: List[Dict[str, Any]] = []

    for path in sorted(trait_paths):
        raw = load_yaml(path)
        trait_meta = raw.get("trait") or {}
        name = trait_meta.get("name")
        if not name:
            continue
        category = trait_meta.get("category") or "uncategorized"
        tags = trait_meta.get("tags") or []
        metadata = raw.get("metadata") or {}
        view_exts = raw.get("view_extensions") or {}
        rel_path = str(path.relative_to(REPO_ROOT))

        view_extensions: List[Dict[str, Any]] = []
        contexts: Set[str] = set()

        for context, entries in view_exts.items():
            if not entries:
                continue
            contexts.add(context)
            for entry in entries:
                if not isinstance(entry, Mapping):
                    continue
                view_extensions.append(
                    {
                        "component": entry.get("component"),
                        "context": context,
                        "position": entry.get("position"),
                        "priority": entry.get("priority"),
                        "props": entry.get("props") or {},
                    }
                )
                component_name = entry.get("component")
                if not component_name:
                    continue
                comp = components_index.setdefault(
                    component_name,
                    {
                        "id": component_name,
                        "displayName": component_name,
                        "categories": set(),
                        "tags": set(),
                        "contexts": set(),
                        "regions": set(),
                        "traitUsages": [],
                        "sourceFiles": set(),
                    },
                )
                comp["categories"].add(category)
                comp["tags"].update(tags)
                comp["contexts"].add(context)
                comp["sourceFiles"].add(rel_path)
                comp["regions"].update(metadata.get("regionsUsed") or [])
                comp["traitUsages"].append(
                    {
                        "trait": name,
                        "traitCategory": category,
                        "context": context,
                        "position": entry.get("position"),
                        "priority": entry.get("priority"),
                        "props": entry.get("props") or {},
                        "source": rel_path,
                    }
                )

        domain = None
        if "domains" in path.parts:
            domain = path.parts[path.parts.index("domains") + 1]
            domain_traits[domain].add(name)

        tokens = raw.get("tokens") or {}
        if tokens:
            trait_overlays.append({"trait": name, "tokens": tokens})

        traits.append(
            {
                "name": name,
                "version": trait_meta.get("version"),
                "description": (trait_meta.get("description") or "").strip(),
                "category": category,
                "tags": tags,
                "contexts": sorted(contexts),
                "viewExtensions": view_extensions,
                "parameters": raw.get("parameters") or [],
                "schema": raw.get("schema") or {},
                "semantics": raw.get("semantics") or {},
                "tokens": tokens,
                "dependencies": raw.get("dependencies") or [],
                "metadata": metadata,
                "objects": [],
                "source": rel_path,
            }
        )

    return traits, components_index, domain_traits, trait_overlays


def collect_objects() -> tuple[List[Dict[str, Any]], Dict[str, Set[str]], Dict[str, Set[str]]]:
    object_paths: List[Path] = []
    object_paths.extend((REPO_ROOT / "objects").glob("**/*.object.yaml"))
    object_paths.extend((REPO_ROOT / "domains").glob("*/objects/*.object.yaml"))

    objects: List[Dict[str, Any]] = []
    trait_object_map: Dict[str, Set[str]] = defaultdict(set)
    domain_objects: Dict[str, Set[str]] = defaultdict(set)

    for path in sorted(object_paths):
        raw = load_yaml(path)
        obj_meta = raw.get("object") or {}
        name = obj_meta.get("name")
        if not name:
            continue
        domain = None
        if "domains" in path.parts:
            domain = path.parts[path.parts.index("domains") + 1]
            domain_objects[domain].add(name)

        trait_entries = []
        for trait in raw.get("traits") or []:
            reference = trait.get("name")
            if reference:
                trait_object_map[normalize_trait_name(reference)].add(name)
            trait_entries.append(
                {
                    "reference": reference,
                    "alias": trait.get("alias"),
                    "parameters": trait.get("parameters") or {},
                }
            )

        rel_path = str(path.relative_to(REPO_ROOT))
        schema = raw.get("schema") or {}

        objects.append(
            {
                "name": name,
                "version": obj_meta.get("version"),
                "domain": obj_meta.get("domain"),
                "description": obj_meta.get("description"),
                "tags": obj_meta.get("tags") or [],
                "traits": trait_entries,
                "fields": list(schema.keys()),
                "semantics": raw.get("semantics") or {},
                "tokens": raw.get("tokens") or {},
                "metadata": raw.get("metadata") or {},
                "source": rel_path,
            }
        )

    return objects, trait_object_map, domain_objects


def finalize_components(index: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    components: List[Dict[str, Any]] = []
    for comp in index.values():
        render_complexity = compute_render_complexity(comp["categories"])
        payload = {
            "id": comp["id"],
            "displayName": comp["displayName"],
            "categories": sorted(comp["categories"]),
            "tags": sorted(comp["tags"]),
            "contexts": sorted(comp["contexts"]),
            "regions": sorted(comp["regions"]),
            "traitUsages": sorted(
                comp["traitUsages"],
                key=lambda entry: (entry.get("trait") or "", entry.get("context") or ""),
            ),
            "sourceFiles": sorted(comp["sourceFiles"]),
        }
        if render_complexity:
            payload["renderComplexity"] = render_complexity
        components.append(payload)
    return sorted(components, key=lambda item: item["id"])


def ensure_basic_components(index: Dict[str, Dict[str, Any]]) -> None:
    source_file = "cmos/scripts/refresh_structured_data.py"
    for definition in BASIC_COMPONENT_DEFINITIONS:
        component_id = str(definition["id"])
        comp = index.setdefault(
            component_id,
            {
                "id": component_id,
                "displayName": component_id,
                "categories": set(),
                "tags": set(),
                "contexts": set(),
                "regions": set(),
                "traitUsages": [],
                "sourceFiles": set(),
            },
        )
        comp["categories"].add("primitive")
        comp["tags"].update(definition.get("tags") or [])
        comp["contexts"].update(definition.get("contexts") or [])
        comp["regions"].update(definition.get("regions") or [])
        comp["sourceFiles"].add(source_file)


def summarize_domains(domain_traits: Dict[str, Set[str]], domain_objects: Dict[str, Set[str]]) -> List[Dict[str, Any]]:
    domains: List[Dict[str, Any]] = []
    for domain in sorted(set(domain_traits.keys()) | set(domain_objects.keys())):
        domains.append(
            {
                "name": domain,
                "objectCount": len(domain_objects.get(domain) or []),
                "objects": sorted(domain_objects.get(domain) or []),
                "traitCount": len(domain_traits.get(domain) or []),
                "traits": sorted(domain_traits.get(domain) or []),
                "source": f"domains/{domain}",
            }
        )
    return domains


def extract_patterns() -> List[Dict[str, Any]]:
    patterns_dir = REPO_ROOT / "docs" / "patterns"
    patterns: List[Dict[str, Any]] = []
    if not patterns_dir.exists():
        return patterns
    for path in sorted(patterns_dir.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        title = lines[0].lstrip("# ").strip() if lines else path.stem
        summary = ""
        for line in lines[1:]:
            if line and not line.startswith("#"):
                summary = line
                break
        slug = title.lower().replace(" ", "-")
        patterns.append(
            {
                "id": slug,
                "title": title,
                "summary": summary,
                "source": str(path.relative_to(REPO_ROOT)),
            }
        )
    return patterns


def build_sample_queries(
    components: List[Dict[str, Any]],
    traits_by_name: Dict[str, Dict[str, Any]],
    trait_overlays: List[Dict[str, Any]],
) -> Dict[str, Any]:
    def slice_components(predicate) -> List[Dict[str, Any]]:
        results = []
        for component in components:
            matching = {
                usage["trait"]
                for usage in component.get("traitUsages", [])
                if predicate(component, usage)
            }
            if matching:
                results.append({"id": component["id"], "traits": sorted(matching)})
        return sorted(results, key=lambda item: item["id"])

    status_traits = {
        name
        for name, payload in traits_by_name.items()
        if any("status" in tag.lower() for tag in payload.get("tags") or [])
        or "state" in name.lower()
    }

    return {
        "formComponents": slice_components(lambda _c, u: u.get("context") == "form"),
        "statusComponents": slice_components(lambda _c, u: u.get("trait") in status_traits),
        "timelineComponents": slice_components(lambda _c, u: u.get("context") == "timeline"),
        "mobileFriendly": slice_components(
            lambda comp, _u: "card" in comp.get("contexts", []) or "inline" in comp.get("contexts", [])
        ),
        "traitOverlaySlices": [
            {
                "trait": overlay["trait"],
                "tokenCount": len(overlay.get("tokens") or {}),
                "sampleTokens": sorted((overlay.get("tokens") or {}).keys())[:3],
            }
            for overlay in trait_overlays
        ],
    }


def build_tokens_payload(trait_overlays: List[Dict[str, Any]], *, generated_at: Optional[str] = None) -> Dict[str, Any]:
    timestamp = generated_at or iso_now()
    layers = {
        "reference": load_json(REPO_ROOT / "tokens" / "base.json"),
        "theme": load_json(REPO_ROOT / "tokens" / "theme.json"),
        "system": load_json(REPO_ROOT / "tokens" / "semantic" / "system.json"),
        "component": load_json(REPO_ROOT / "tokens" / "semantic" / "components.json"),
        "view": load_json(REPO_ROOT / "tokens" / "view.json"),
    }

    maps: Dict[str, Any] = {}
    maps_dir = REPO_ROOT / "tokens" / "maps"
    for path in sorted(maps_dir.glob("*.json")):
        maps[path.stem] = load_json(path)

    token_counts = {name: count_tokens(payload) for name, payload in layers.items()}

    return {
        "generatedAt": timestamp,
        "sources": {
            "base": "tokens/base.json",
            "theme": "tokens/theme.json",
            "semantic": {
                "system": "tokens/semantic/system.json",
                "components": "tokens/semantic/components.json",
            },
            "view": "tokens/view.json",
            "maps": sorted(maps.keys()),
            "traitOverlays": len(trait_overlays),
        },
        "layers": layers,
        "maps": maps,
        "traitOverlays": trait_overlays,
        "stats": {
            "referenceTokens": token_counts.get("reference", 0),
            "themeTokens": token_counts.get("theme", 0),
            "systemTokens": token_counts.get("system", 0),
            "componentTokens": token_counts.get("component", 0),
            "viewTokens": token_counts.get("view", 0),
            "mapCount": len(maps),
            "traitOverlayCount": len(trait_overlays),
        },
    }


def render_delta(
    old_components: Dict[str, Any],
    new_components: Dict[str, Any],
    old_tokens: Dict[str, Any],
    new_tokens: Dict[str, Any],
    old_code_connect: Optional[Dict[str, Any]] = None,
    new_code_connect: Optional[Dict[str, Any]] = None,
) -> str:
    def id_set(payload: Dict[str, Any], key: str) -> Set[str]:
        ids: Set[str] = set()
        for item in payload.get(key, []):
            if not isinstance(item, Mapping):
                continue
            value = item.get("id") or item.get("name")
            if value:
                ids.add(str(value))
        return ids

    old_component_ids = id_set(old_components, "components")
    new_component_ids = id_set(new_components, "components")
    old_trait_ids = id_set(old_components, "traits")
    new_trait_ids = id_set(new_components, "traits")
    old_object_ids = id_set(old_components, "objects")
    new_object_ids = id_set(new_components, "objects")

    def fmt_delta(label: str, old: int, new: int) -> str:
        diff = new - old
        sign = "+" if diff >= 0 else "-"
        return f"- {label}: {old} -> {new} ({sign}{abs(diff)})"

    lines = []
    lines.append("# Structured Data Delta")
    lines.append(f"- Baseline: {old_components.get('generatedAt', 'unknown')}")
    lines.append(f"- Current:  {new_components.get('generatedAt', 'unknown')}")
    lines.append("")
    lines.append("## Catalogue Stats")
    lines.append(
        fmt_delta(
            "Components",
            old_components.get("stats", {}).get("componentCount", len(old_component_ids)),
            new_components.get("stats", {}).get("componentCount", len(new_component_ids)),
        )
    )
    lines.append(
        fmt_delta(
            "Traits",
            old_components.get("stats", {}).get("traitCount", len(old_trait_ids)),
            new_components.get("stats", {}).get("traitCount", len(new_trait_ids)),
        )
    )
    lines.append(
        fmt_delta(
            "Objects",
            old_components.get("stats", {}).get("objectCount", len(old_object_ids)),
            new_components.get("stats", {}).get("objectCount", len(new_object_ids)),
        )
    )
    lines.append(
        fmt_delta(
            "Domains",
            old_components.get("stats", {}).get("domainCount", 0),
            new_components.get("stats", {}).get("domainCount", 0),
        )
    )
    lines.append(
        fmt_delta(
            "Patterns",
            old_components.get("stats", {}).get("patternCount", 0),
            new_components.get("stats", {}).get("patternCount", 0),
        )
    )
    lines.append("")
    lines.append("### Added / Removed")
    added_components = sorted(new_component_ids - old_component_ids)
    removed_components = sorted(old_component_ids - new_component_ids)
    added_traits = sorted(new_trait_ids - old_trait_ids)
    removed_traits = sorted(old_trait_ids - new_trait_ids)
    added_objects = sorted(new_object_ids - old_object_ids)
    removed_objects = sorted(old_object_ids - new_object_ids)
    lines.append(f"- Added components: {', '.join(added_components) or 'none'}")
    lines.append(f"- Removed components: {', '.join(removed_components) or 'none'}")
    lines.append(f"- Added traits: {', '.join(added_traits) or 'none'}")
    lines.append(f"- Removed traits: {', '.join(removed_traits) or 'none'}")
    lines.append(f"- Added objects: {', '.join(added_objects) or 'none'}")
    lines.append(f"- Removed objects: {', '.join(removed_objects) or 'none'}")
    lines.append("")

    lines.append("## Token Stats")
    old_token_stats = old_tokens.get("stats") or {}
    new_token_stats = new_tokens.get("stats") or {}
    for label in (
        "referenceTokens",
        "themeTokens",
        "systemTokens",
        "componentTokens",
        "viewTokens",
        "traitOverlayCount",
        "mapCount",
    ):
        lines.append(fmt_delta(label, int(old_token_stats.get(label, 0)), int(new_token_stats.get(label, 0))))
    lines.append("")

    lines.append("## Sample Query Coverage")
    for key, values in (new_components.get("sampleQueries") or {}).items():
        size = len(values) if isinstance(values, Iterable) else 0
        lines.append(f"- {key}: {size} entries")

    if old_code_connect is not None or new_code_connect is not None:
        lines.append("")
        lines.append("## Code Connect Snippets")

        baseline_etag = compute_etag(old_code_connect) if old_code_connect else None
        current_etag = compute_etag(new_code_connect) if new_code_connect else None

        lines.append(f"- Baseline etag: {baseline_etag or 'none'}")
        lines.append(f"- Current etag:  {current_etag or 'none'}")
        if baseline_etag and current_etag:
            lines.append(f"- Changed: {'yes' if baseline_etag != current_etag else 'no'}")

        components_block = (new_code_connect or {}).get("components") if isinstance(new_code_connect, Mapping) else None
        if isinstance(components_block, Mapping):
            component_count = len(components_block)
            reference_count = sum(len(refs) for refs in components_block.values() if isinstance(refs, list))
            lines.append(f"- Components with snippets: {component_count}")
            lines.append(f"- Total references: {reference_count}")

    return "\n".join(lines)


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def generate_structured_payloads(*, generated_at: Optional[str] = None) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    traits, components_index, domain_traits, trait_overlays = collect_traits()
    objects, trait_object_map, domain_objects = collect_objects()

    traits_by_name = {trait["name"]: trait for trait in traits}
    for trait in traits:
        trait["objects"] = sorted(trait_object_map.get(trait["name"]) or [])

    ensure_basic_components(components_index)
    components = finalize_components(components_index)
    domains = summarize_domains(domain_traits, domain_objects)
    patterns = extract_patterns()
    sample_queries = build_sample_queries(components, traits_by_name, trait_overlays)

    timestamp = generated_at or iso_now()
    components_payload = {
        "$schema": "./component-schema.json",
        "generatedAt": timestamp,
        "stats": {
            "componentCount": len(components),
            "traitCount": len(traits),
            "objectCount": len(objects),
            "domainCount": len(domains),
            "patternCount": len(patterns),
        },
        "components": components,
        "traits": sorted(traits, key=lambda item: item["name"]),
        "objects": sorted(objects, key=lambda item: item["name"]),
        "domains": domains,
        "patterns": patterns,
        "sampleQueries": sample_queries,
    }

    schema = load_json(COMPONENT_SCHEMA_PATH)
    validate(instance=components_payload, schema=schema)

    tokens_payload = build_tokens_payload(trait_overlays, generated_at=timestamp)
    return components_payload, tokens_payload


def canonicalize_payload(payload: Dict[str, Any], *, drop_keys: Tuple[str, ...] = ("generatedAt",)) -> str:
    """Return a canonical JSON string for hashing and diffing."""
    sanitized = dict(payload)
    for key in drop_keys:
        sanitized.pop(key, None)
    return json.dumps(sanitized, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def compute_etag(payload: Dict[str, Any], *, drop_keys: Tuple[str, ...] = ("generatedAt",)) -> str:
    """Compute a stable ETag-style hash for a payload."""
    canonical = canonicalize_payload(payload, drop_keys=drop_keys)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class ImportInfo:
    style: str
    module: str


def list_story_files(stories_dir: Path) -> List[Path]:
    if not stories_dir.exists():
        return []
    paths: List[Path] = []
    paths.extend(stories_dir.rglob("*.stories.tsx"))
    paths.extend(stories_dir.rglob("*.stories.ts"))
    unique = {path.resolve(): path for path in paths if path.is_file()}
    return sorted(unique.values(), key=lambda p: p.as_posix())


def extract_story_title(source: str) -> Optional[str]:
    match = re.search(r"\btitle:\s*['\"]([^'\"]+)['\"]", source)
    return match.group(1) if match else None


def extract_view_extensions_blocks(source: str) -> List[str]:
    blocks: List[str] = []
    re_block = re.compile(r"`(view_extensions:.*?)`", flags=re.DOTALL)
    for match in re_block.finditer(source):
        blocks.append(match.group(1))
    return blocks


def build_view_extension_snippets(yaml_block: str) -> Dict[str, str]:
    lines = yaml_block.splitlines()
    snippets: Dict[str, str] = {}

    current_context_line: Optional[str] = None
    header = next((candidate for candidate in lines if candidate.strip() == "view_extensions:"), "view_extensions:")

    for line_index, line in enumerate(lines):
        context_match = re.match(r"^\s{2}([A-Za-z0-9_]+):\s*$", line)
        if context_match:
            current_context_line = line
            continue

        component_match = re.match(r"^\s*-\s*component:\s*([A-Za-z0-9_]+)\s*$", line)
        if not component_match:
            continue

        component_name = component_match.group(1)
        component_indent = len(re.match(r"^(\s*)", line).group(1))

        block_lines: List[str] = [header]
        if current_context_line:
            block_lines.append(current_context_line)
        block_lines.append(line)

        for next_line in lines[line_index + 1 :]:
            if not next_line.strip():
                break

            next_indent = len(re.match(r"^(\s*)", next_line).group(1))
            trimmed = next_line.strip()

            if next_indent <= component_indent and trimmed.endswith(":"):
                break
            if next_indent <= component_indent and trimmed.startswith("-"):
                break

            block_lines.append(next_line)

        snippet = "\n".join(block_lines).strip()
        if snippet and component_name not in snippets:
            snippets[component_name] = snippet

    return snippets


def parse_named_import_locals(named_imports: str) -> List[str]:
    locals_: List[str] = []
    for part in named_imports.split(","):
        part = part.strip()
        if not part:
            continue
        cleaned = re.sub(r"^type\s+", "", part).strip()
        pieces = re.split(r"\s+as\s+", cleaned)
        imported = pieces[0].strip() if pieces else ""
        local = (pieces[1] if len(pieces) > 1 else imported).strip()
        if local:
            locals_.append(local)
    return locals_


def find_import_for_identifier(source: str, identifier: str) -> Optional[ImportInfo]:
    escaped = re.escape(identifier)

    namespace_re = re.compile(rf"\bimport\s+\*\s+as\s+{escaped}\s+from\s+['\"]([^'\"]+)['\"]")
    namespace_match = namespace_re.search(source)
    if namespace_match and namespace_match.group(1):
        return ImportInfo(style="namespace", module=namespace_match.group(1))

    mixed_re = re.compile(
        r"import\s+([A-Za-z0-9_$]+)\s*,\s*{\s*([\s\S]*?)\s*}\s*from\s*['\"]([^'\"]+)['\"]\s*;?"
    )
    for match in mixed_re.finditer(source):
        default_local = match.group(1)
        named_part = match.group(2)
        module = match.group(3)
        if default_local == identifier:
            return ImportInfo(style="default", module=module)
        if identifier in parse_named_import_locals(named_part):
            return ImportInfo(style="named", module=module)

    default_re = re.compile(rf"\bimport\s+{escaped}\s+from\s+['\"]([^'\"]+)['\"]")
    default_match = default_re.search(source)
    if default_match and default_match.group(1):
        return ImportInfo(style="default", module=default_match.group(1))

    named_re = re.compile(r"import\s*{\s*([\s\S]*?)\s*}\s*from\s*['\"]([^'\"]+)['\"]\s*;?")
    for match in named_re.finditer(source):
        named_part = match.group(1)
        module = match.group(2)
        if identifier in parse_named_import_locals(named_part):
            return ImportInfo(style="named", module=module)

    return None


def build_react_usage_snippet(source: str, identifier: str, import_info: ImportInfo) -> str:
    if import_info.style == "named":
        import_line = f"import {{ {identifier} }} from '{import_info.module}';"
    elif import_info.style == "default":
        import_line = f"import {identifier} from '{import_info.module}';"
    else:
        import_line = f"import * as {identifier} from '{import_info.module}';"

    has_children = bool(re.search(rf"<{re.escape(identifier)}\b[^>]*>", source)) and bool(
        re.search(rf"</{re.escape(identifier)}>", source)
    )
    jsx = f"<{identifier}>...</{identifier}>" if has_children else f"<{identifier} />"
    return f"{import_line}\n\nexport function Example() {{\n  return {jsx};\n}}"


def is_identifier_char(value: str) -> bool:
    return bool(re.match(r"[A-Za-z0-9_]", value))


def find_word_index(haystack: str, needle: str) -> int:
    index = haystack.find(needle)
    while index != -1:
        before = haystack[index - 1] if index > 0 else ""
        after_index = index + len(needle)
        after = haystack[after_index] if after_index < len(haystack) else ""
        if not is_identifier_char(before) and not is_identifier_char(after):
            return index
        index = haystack.find(needle, index + len(needle))
    return -1


def extract_line_snippet(source: str, needle: str) -> str:
    lines = source.splitlines()
    match_index = next((idx for idx, line in enumerate(lines) if needle in line), -1)
    if match_index == -1:
        return needle

    start = max(0, match_index - 2)
    end = min(len(lines), match_index + 4)
    snippet = "\n".join(lines[start:end]).strip()

    limit = 900
    if len(snippet) <= limit:
        return snippet
    return f"{snippet[:limit]}\n…"


def resolve_upstream_stories_dir(
    *,
    upstream_root: Optional[Path],
    upstream_stories_dir: Optional[Path],
) -> Optional[Path]:
    if upstream_stories_dir:
        return Path(upstream_stories_dir)
    if upstream_root:
        return Path(upstream_root) / "stories"

    env_stories = os.environ.get("OODS_FOUNDRY_STORIES_DIR")
    if env_stories:
        return Path(env_stories)

    env_root = os.environ.get("OODS_FOUNDRY_ROOT")
    if env_root:
        return Path(env_root) / "stories"

    sibling = REPO_ROOT.parent / "OODS-Foundry"
    candidate = sibling / "stories"
    if candidate.exists():
        return candidate

    return None


def generate_code_connect_payload(
    *,
    component_names: List[str],
    stories_dir: Optional[Path],
    generated_at: str,
    max_refs_per_component: int = 3,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "generatedAt": generated_at,
        "components": {},
        "stats": {"storyFileCount": 0, "componentCount": 0, "referenceCount": 0},
    }

    if not stories_dir or not stories_dir.exists():
        return payload

    story_files = list_story_files(stories_dir)
    payload["stats"]["storyFileCount"] = len(story_files)

    source_root = stories_dir.parent if stories_dir.name == "stories" else stories_dir
    index: Dict[str, List[Dict[str, str]]] = {}

    for story_file in story_files:
        try:
            source = story_file.read_text(encoding="utf-8")
        except Exception:
            continue

        story_title = extract_story_title(source)
        view_snippets: Dict[str, str] = {}
        for block in extract_view_extensions_blocks(source):
            for component_name, snippet in build_view_extension_snippets(block).items():
                if component_name not in view_snippets:
                    view_snippets[component_name] = snippet

        for component_name in component_names:
            if len(index.get(component_name, [])) >= max_refs_per_component:
                continue

            snippet = view_snippets.get(component_name)
            if not snippet:
                import_info = find_import_for_identifier(source, component_name)
                if import_info:
                    snippet = build_react_usage_snippet(source, component_name, import_info)

            if not snippet:
                if find_word_index(source, component_name) == -1:
                    continue
                snippet = extract_line_snippet(source, component_name)

            if not snippet:
                continue

            try:
                relative_path = story_file.resolve().relative_to(source_root.resolve()).as_posix()
            except ValueError:
                relative_path = story_file.as_posix()

            ref: Dict[str, str] = {"path": relative_path, "snippet": snippet}
            if story_title:
                ref["title"] = story_title

            index.setdefault(component_name, []).append(ref)

    payload["components"] = {name: refs for name, refs in index.items() if refs}
    payload["stats"]["componentCount"] = len(payload["components"])
    payload["stats"]["referenceCount"] = sum(len(refs) for refs in payload["components"].values())
    return payload


def resolve_baseline_path(
    explicit: Optional[Path],
    *,
    default: Path,
    legacy: Path,
    fallback: Path,
) -> Path:
    """Pick a baseline path preferring explicit, then current planning output, then legacy research, else fallback."""
    if explicit:
        return Path(explicit)
    if default.exists():
        return default
    if legacy.exists():
        return legacy
    return fallback


def _relative_to_repo(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def write_versioned_artifacts(
    *,
    components_payload: Dict[str, Any],
    tokens_payload: Dict[str, Any],
    code_connect_payload: Optional[Dict[str, Any]] = None,
    components_path: Path,
    tokens_path: Path,
    code_connect_path: Optional[Path] = None,
    delta_path: Optional[Path],
    artifact_dir: Path,
    version_tag: Optional[str],
) -> Path:
    normalized_tag = None
    if version_tag and version_tag.lower() != "auto":
        normalized_tag = version_tag

    version = normalized_tag or (components_payload.get("generatedAt") or iso_now()).split("T")[0]
    artifact_dir.mkdir(parents=True, exist_ok=True)

    components_artifact = artifact_dir / f"oods-components-{version}.json"
    tokens_artifact = artifact_dir / f"oods-tokens-{version}.json"
    shutil.copy2(components_path, components_artifact)
    shutil.copy2(tokens_path, tokens_artifact)

    manifest = {
        "generatedAt": components_payload.get("generatedAt"),
        "version": version,
        "source": {
            "components": _relative_to_repo(components_path),
            "tokens": _relative_to_repo(tokens_path),
        },
        "artifacts": [
            {
                "name": "components",
                "file": components_artifact.name,
                "path": _relative_to_repo(components_artifact),
                "etag": compute_etag(components_payload),
                "sizeBytes": components_artifact.stat().st_size,
            },
            {
                "name": "tokens",
                "file": tokens_artifact.name,
                "path": _relative_to_repo(tokens_artifact),
                "etag": compute_etag(tokens_payload),
                "sizeBytes": tokens_artifact.stat().st_size,
            },
        ],
    }
    if code_connect_payload and code_connect_path and code_connect_path.exists():
        manifest["artifacts"].append(
            {
                "name": "code-connect",
                "file": code_connect_path.name,
                "path": _relative_to_repo(code_connect_path),
                "etag": compute_etag(code_connect_payload),
                "sizeBytes": code_connect_path.stat().st_size,
            }
        )
    if delta_path:
        manifest["delta"] = {"file": delta_path.name, "path": _relative_to_repo(delta_path)}

    schema = load_json(MANIFEST_SCHEMA_PATH)
    validate(instance=manifest, schema=schema)

    manifest_path = artifact_dir / "manifest.json"
    write_json(manifest_path, manifest)
    return manifest_path


def refresh_structured_data(
    *,
    output_dir: Path = OUTPUT_DIR,
    baseline_components_path: Optional[Path] = None,
    baseline_tokens_path: Optional[Path] = None,
    generated_at: Optional[str] = None,
    include_delta: bool = True,
    artifact_dir: Optional[Path] = None,
    version_tag: Optional[str] = None,
    upstream_root: Optional[Path] = None,
    upstream_stories_dir: Optional[Path] = None,
) -> RefreshResult:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    components_payload, tokens_payload = generate_structured_payloads(generated_at=generated_at)

    components_path = output_dir / "oods-components.json"
    tokens_path = output_dir / "oods-tokens.json"
    resolved_baseline_components = resolve_baseline_path(
        baseline_components_path,
        default=DEFAULT_BASELINE_COMPONENTS_PATH,
        legacy=LEGACY_BASELINE_COMPONENTS_PATH,
        fallback=components_path,
    )
    resolved_baseline_tokens = resolve_baseline_path(
        baseline_tokens_path,
        default=DEFAULT_BASELINE_TOKENS_PATH,
        legacy=LEGACY_BASELINE_TOKENS_PATH,
        fallback=tokens_path,
    )

    old_components = load_json(resolved_baseline_components) if resolved_baseline_components.exists() else components_payload
    old_tokens = load_json(resolved_baseline_tokens) if resolved_baseline_tokens.exists() else tokens_payload

    write_json(components_path, components_payload)
    write_json(tokens_path, tokens_payload)

    code_connect_payload = None
    old_code_connect = None
    code_connect_artifact = None
    code_connect_path = None

    if artifact_dir:
        code_connect_path = Path(artifact_dir) / "code-connect.json"
        if include_delta and code_connect_path.exists():
            try:
                old_code_connect = load_json(code_connect_path)
            except Exception:
                old_code_connect = None

        component_names: List[str] = []
        for component in components_payload.get("components", []):
            if isinstance(component, Mapping) and component.get("id"):
                component_names.append(str(component["id"]))

        for extra in ("Button", "Card", "Stack", "Text"):
            if extra not in component_names:
                component_names.append(extra)

        resolved_stories_dir = resolve_upstream_stories_dir(
            upstream_root=upstream_root,
            upstream_stories_dir=upstream_stories_dir,
        )
        if resolved_stories_dir and not resolved_stories_dir.exists():
            resolved_stories_dir = None

        code_connect_payload = generate_code_connect_payload(
            component_names=component_names,
            stories_dir=resolved_stories_dir,
            generated_at=components_payload["generatedAt"],
        )
        write_json(code_connect_path, code_connect_payload)
        code_connect_artifact = ExtractedArtifact(
            name="code-connect",
            path=code_connect_path,
            etag=compute_etag(code_connect_payload),
            size_bytes=code_connect_path.stat().st_size,
        )

    delta_path = None
    if include_delta:
        delta_report = render_delta(
            old_components,
            components_payload,
            old_tokens,
            tokens_payload,
            old_code_connect,
            code_connect_payload,
        )
        delta_path = output_dir / f"structured-data-delta-{components_payload['generatedAt'].split('T')[0]}.md"
        delta_path.write_text(delta_report + "\n", encoding="utf-8")

    components_artifact = ExtractedArtifact(
        name="components",
        path=components_path,
        etag=compute_etag(components_payload),
        size_bytes=components_path.stat().st_size,
    )
    tokens_artifact = ExtractedArtifact(
        name="tokens",
        path=tokens_path,
        etag=compute_etag(tokens_payload),
        size_bytes=tokens_path.stat().st_size,
    )

    manifest_path = None
    if artifact_dir:
        manifest_path = write_versioned_artifacts(
            components_payload=components_payload,
            tokens_payload=tokens_payload,
            code_connect_payload=code_connect_payload,
            components_path=components_path,
            tokens_path=tokens_path,
            code_connect_path=code_connect_path,
            delta_path=delta_path,
            artifact_dir=artifact_dir,
            version_tag=version_tag,
        )

    return RefreshResult(
        components=components_artifact,
        tokens=tokens_artifact,
        code_connect=code_connect_artifact,
        delta_path=delta_path,
        manifest_path=manifest_path,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Refresh OODS structured data exports.")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=OUTPUT_DIR,
        help="Directory for canonical outputs (defaults to cmos/planning).",
    )
    parser.add_argument(
        "--baseline-components",
        type=Path,
        help="Baseline components JSON for delta generation (defaults to planning output, then cmos/research if present).",
    )
    parser.add_argument(
        "--baseline-tokens",
        type=Path,
        help="Baseline tokens JSON for delta generation (defaults to planning output, then cmos/research if present).",
    )
    parser.add_argument(
        "--generated-at",
        help="Override generatedAt timestamp for reproducible builds.",
    )
    parser.add_argument(
        "--skip-delta",
        action="store_true",
        help="Skip writing delta report.",
    )
    parser.add_argument(
        "--artifact-dir",
        type=Path,
        help="Write versioned artifacts and manifest with ETags to this directory.",
    )
    parser.add_argument(
        "--upstream-root",
        type=Path,
        help="Path to upstream OODS-Foundry repo root (expects stories/).",
    )
    parser.add_argument(
        "--upstream-stories-dir",
        type=Path,
        help="Path to upstream stories directory (overrides --upstream-root).",
    )
    parser.add_argument(
        "--version-tag",
        help="Custom tag for artifact filenames (use 'auto' or omit to default to YYYY-MM-DD from generatedAt).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    result = refresh_structured_data(
        output_dir=args.output_dir,
        baseline_components_path=args.baseline_components,
        baseline_tokens_path=args.baseline_tokens,
        generated_at=args.generated_at,
        include_delta=not args.skip_delta,
        artifact_dir=args.artifact_dir,
        version_tag=args.version_tag,
        upstream_root=args.upstream_root,
        upstream_stories_dir=args.upstream_stories_dir,
    )

    print("Refreshed structured data.")
    print(f"- components: {result.components.path} (etag: {result.components.etag})")
    print(f"- tokens:     {result.tokens.path} (etag: {result.tokens.etag})")
    if result.code_connect:
        print(f"- code:       {result.code_connect.path} (etag: {result.code_connect.etag})")
    if result.delta_path:
        print(f"- delta:      {result.delta_path}")
    if result.manifest_path:
        print(f"- manifest:   {result.manifest_path}")


if __name__ == "__main__":
    main()
