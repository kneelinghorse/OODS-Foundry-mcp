from __future__ import annotations

import json
from pathlib import Path

import pytest

from tools.refresh_structured_data import (
    compute_etag,
    generate_structured_payloads,
    refresh_structured_data,
)


ROOT = Path(__file__).resolve().parents[2]
PLANNING_DIR = ROOT / "OODS-Foundry-mcp" / "cmos" / "planning"
BASELINE_COMPONENTS = PLANNING_DIR / "oods-components.json"
BASELINE_TOKENS = PLANNING_DIR / "oods-tokens.json"
EXPECTED_GENERATED_AT = "2025-11-22T01:09:14Z"


@pytest.fixture(scope="session")
def payloads() -> tuple[dict, dict]:
    return generate_structured_payloads(generated_at=EXPECTED_GENERATED_AT)


def test_structured_payloads_match_snapshot(payloads: tuple[dict, dict]) -> None:
    components_payload, tokens_payload = payloads
    expected_components = json.loads(BASELINE_COMPONENTS.read_text())
    expected_tokens = json.loads(BASELINE_TOKENS.read_text())

    assert components_payload == expected_components
    assert tokens_payload == expected_tokens


def test_etags_are_stable(payloads: tuple[dict, dict]) -> None:
    components_payload, tokens_payload = payloads

    assert compute_etag(components_payload) == "d1fb2f20e80d08a156eb7eeffb5dcd09fed055839796aedd9058e21e6f224be6"
    assert compute_etag(tokens_payload) == "0194d6f1863cebe4dcc751640d3708bda48a1bc59490352212d86d300d224ce5"


def test_refresh_writes_outputs_and_manifest(tmp_path: Path) -> None:
    result = refresh_structured_data(
        output_dir=tmp_path,
        baseline_components_path=BASELINE_COMPONENTS,
        baseline_tokens_path=BASELINE_TOKENS,
        generated_at=EXPECTED_GENERATED_AT,
        artifact_dir=tmp_path / "artifacts",
        version_tag="test-run",
    )

    assert result.components.path.exists()
    assert result.tokens.path.exists()
    assert result.delta_path and result.delta_path.exists()
    assert result.manifest_path and result.manifest_path.exists()

    delta_contents = result.delta_path.read_text()
    assert "Structured Data Delta" in delta_contents

    manifest = json.loads(result.manifest_path.read_text())
    assert manifest["version"] == "test-run"
    assert manifest["artifacts"][0]["etag"] == result.components.etag
    assert manifest["artifacts"][1]["etag"] == result.tokens.etag
