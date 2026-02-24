from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

CMOS_ROOT = Path(__file__).resolve().parents[1]
if str(CMOS_ROOT) not in sys.path:
    sys.path.insert(0, str(CMOS_ROOT))

from scripts.refresh_structured_data import (  # noqa: E402
    DEFAULT_BASELINE_COMPONENTS_PATH,
    DEFAULT_BASELINE_TOKENS_PATH,
    OUTPUT_DIR,
    compute_etag,
    generate_code_connect_payload,
    generate_structured_payloads,
    refresh_structured_data,
)

EXPECTED_GENERATED_AT = "2026-02-24T05:09:44Z"


class RefreshStructuredDataTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.components_payload, cls.tokens_payload = generate_structured_payloads(
            generated_at=EXPECTED_GENERATED_AT
        )

    def test_defaults_target_planning_directory(self) -> None:
        self.assertEqual(OUTPUT_DIR, CMOS_ROOT / "planning")
        self.assertEqual(DEFAULT_BASELINE_COMPONENTS_PATH, OUTPUT_DIR / "oods-components.json")
        self.assertEqual(DEFAULT_BASELINE_TOKENS_PATH, OUTPUT_DIR / "oods-tokens.json")

    def test_structured_payloads_match_snapshot(self) -> None:
        expected_components = json.loads(DEFAULT_BASELINE_COMPONENTS_PATH.read_text())
        expected_tokens = json.loads(DEFAULT_BASELINE_TOKENS_PATH.read_text())

        self.assertEqual(self.components_payload, expected_components)
        self.assertEqual(self.tokens_payload, expected_tokens)

    def test_etags_are_stable(self) -> None:
        self.assertEqual(
            compute_etag(self.components_payload),
            "60c44643e57a55566ebb216000b57f3617a3ee6ef2c410b9cc10f1d72185be42",
        )
        self.assertEqual(
            compute_etag(self.tokens_payload),
            "6075b0688222792508151ec4e86051ae6261882a359f9d1c6bef2962e0156d65",
        )

    def test_refresh_writes_outputs_and_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            tmp_path = Path(temp_dir)
            upstream_dir = tmp_path / "upstream" / "stories" / "components"
            upstream_dir.mkdir(parents=True, exist_ok=True)
            (upstream_dir / "TagInput.stories.tsx").write_text(
                "\n".join(
                    [
                        "import { TagInput } from '@oods/foundry';",
                        "",
                        "export default {",
                        "  title: 'Components/TagInput',",
                        "};",
                        "",
                        "const yaml = `view_extensions:",
                        "  demo:",
                        "    - component: TagInput",
                        "      props:",
                        "        foo: bar",
                        "`;",
                        "",
                    ]
                ),
                encoding="utf-8",
            )
            (upstream_dir / "Button.stories.tsx").write_text(
                "\n".join(
                    [
                        "import { Button } from '@oods/foundry';",
                        "",
                        "export default {",
                        "  title: 'Components/Button',",
                        "};",
                        "",
                        "const yaml = `view_extensions:",
                        "  demo:",
                        "    - component: Button",
                        "      props:",
                        "        label: OK",
                        "`;",
                        "",
                    ]
                ),
                encoding="utf-8",
            )
            (upstream_dir / "Primitives.stories.tsx").write_text(
                "\n".join(
                    [
                        "export default {",
                        "  title: 'Components/Primitives',",
                        "};",
                        "",
                        "const yaml = `view_extensions:",
                        "  demo:",
                        "    - component: Card",
                        "      props:",
                        "        variant: default",
                        "    - component: Text",
                        "      props:",
                        "        content: Hello",
                        "    - component: Stack",
                        "      props:",
                        "        gap: 2",
                        "`;",
                        "",
                    ]
                ),
                encoding="utf-8",
            )
            result = refresh_structured_data(
                output_dir=tmp_path,
                baseline_components_path=DEFAULT_BASELINE_COMPONENTS_PATH,
                baseline_tokens_path=DEFAULT_BASELINE_TOKENS_PATH,
                generated_at=EXPECTED_GENERATED_AT,
                artifact_dir=tmp_path / "artifacts",
                version_tag="test-run",
                upstream_stories_dir=tmp_path / "upstream" / "stories",
            )

            self.assertTrue(result.components.path.exists())
            self.assertTrue(result.tokens.path.exists())
            self.assertTrue(result.code_connect and result.code_connect.path.exists())
            self.assertTrue(result.delta_path and result.delta_path.exists())
            self.assertTrue(result.manifest_path and result.manifest_path.exists())

            delta_contents = result.delta_path.read_text()
            self.assertIn("Structured Data Delta", delta_contents)
            self.assertIn("## Catalogue Stats", delta_contents)
            self.assertIn("## Token Stats", delta_contents)

            manifest = json.loads(result.manifest_path.read_text())
            self.assertEqual(manifest["version"], "test-run")
            self.assertEqual(manifest["artifacts"][0]["etag"], result.components.etag)
            self.assertEqual(manifest["artifacts"][1]["etag"], result.tokens.etag)
            self.assertEqual(manifest["artifacts"][2]["etag"], result.code_connect.etag)
            self.assertEqual(manifest["artifacts"][2]["file"], "code-connect.json")

            code_connect = json.loads(result.code_connect.path.read_text())
            self.assertIn("TagInput", code_connect.get("components", {}))
            self.assertIn("Button", code_connect.get("components", {}))
            self.assertIn("Card", code_connect.get("components", {}))
            self.assertIn("Text", code_connect.get("components", {}))
            self.assertIn("Stack", code_connect.get("components", {}))
            self.assertEqual(
                code_connect["components"]["TagInput"][0]["path"],
                "stories/components/TagInput.stories.tsx",
            )
            self.assertIn("view_extensions:", code_connect["components"]["TagInput"][0]["snippet"])
            self.assertNotIn("import { TagInput", code_connect["components"]["TagInput"][0]["snippet"])

    def test_version_tag_auto_defaults_to_run_date(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            tmp_path = Path(temp_dir)
            result = refresh_structured_data(
                output_dir=tmp_path,
                baseline_components_path=DEFAULT_BASELINE_COMPONENTS_PATH,
                baseline_tokens_path=DEFAULT_BASELINE_TOKENS_PATH,
                generated_at=EXPECTED_GENERATED_AT,
                artifact_dir=tmp_path / "artifacts",
                version_tag="auto",
            )

            manifest = json.loads(result.manifest_path.read_text())
            expected_version = EXPECTED_GENERATED_AT.split("T")[0]
            self.assertEqual(manifest["version"], expected_version)
            self.assertEqual(manifest["artifacts"][0]["file"], f"oods-components-{expected_version}.json")
            self.assertEqual(manifest["artifacts"][1]["file"], f"oods-tokens-{expected_version}.json")
            self.assertEqual(manifest["artifacts"][2]["file"], "code-connect.json")

    def test_code_connect_import_tier(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            tmp_path = Path(temp_dir)
            stories_dir = tmp_path / "upstream" / "stories"
            story_file = stories_dir / "components" / "Example.stories.tsx"
            story_file.parent.mkdir(parents=True, exist_ok=True)
            story_file.write_text(
                "\n".join(
                    [
                        "import { TagInput } from '@oods/foundry';",
                        "",
                        "export default {",
                        "  title: 'Components/TagInput',",
                        "};",
                        "",
                        "export function Demo() {",
                        "  return <TagInput />;",
                        "}",
                        "",
                    ]
                ),
                encoding="utf-8",
            )

            payload = generate_code_connect_payload(
                component_names=["TagInput"],
                stories_dir=stories_dir,
                generated_at=EXPECTED_GENERATED_AT,
            )

            refs = payload.get("components", {}).get("TagInput", [])
            self.assertTrue(refs)
            self.assertIn("import { TagInput } from '@oods/foundry';", refs[0]["snippet"])
            self.assertIn("export function Example()", refs[0]["snippet"])

    def test_code_connect_line_context_tier(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            tmp_path = Path(temp_dir)
            stories_dir = tmp_path / "upstream" / "stories"
            story_file = stories_dir / "components" / "Example.stories.tsx"
            story_file.parent.mkdir(parents=True, exist_ok=True)
            story_file.write_text(
                "\n".join(
                    [
                        "export default { title: 'Components/TagInput' };",
                        "// TagInput appears in a comment but no import is present.",
                        "export const Demo = () => null;",
                        "",
                    ]
                ),
                encoding="utf-8",
            )

            payload = generate_code_connect_payload(
                component_names=["TagInput"],
                stories_dir=stories_dir,
                generated_at=EXPECTED_GENERATED_AT,
            )

            refs = payload.get("components", {}).get("TagInput", [])
            self.assertTrue(refs)
            self.assertIn("TagInput", refs[0]["snippet"])
            self.assertNotIn("import { TagInput", refs[0]["snippet"])


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
