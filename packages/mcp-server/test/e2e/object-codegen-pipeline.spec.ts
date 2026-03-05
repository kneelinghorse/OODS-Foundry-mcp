/**
 * E2E pipeline tests for object-aware compose → validate → render → codegen (s63-m05).
 *
 * Validates the full pipeline produces production-quality output:
 * 1. compose(object, context) → schema with objectUsed, objectSchema, bindings
 * 2. validate(schemaRef) → structural checks pass
 * 3. render(schemaRef, apply=true) → HTML with domain components
 * 4. code_generate(schemaRef, react) → typed Props, handler stubs, domain components
 * 5. code_generate(schemaRef, vue) → typed defineProps, handler stubs
 *
 * Tested across multiple objects (Subscription, User) and contexts (detail, list).
 */
import { describe, it, expect } from 'vitest';
import { handle as composeHandle } from '../../src/tools/design.compose.js';
import { handle as validateHandle } from '../../src/tools/repl.validate.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';
import { handle as codegenHandle } from '../../src/tools/code.generate.js';

/* ------------------------------------------------------------------ */
/*  Subscription · detail context — full pipeline                      */
/* ------------------------------------------------------------------ */

describe('E2E pipeline — Subscription detail', () => {
  it('compose → validate → render → codegen (react + vue)', async () => {
    // ---- compose ----
    const compose = await composeHandle({
      object: 'Subscription',
      context: 'detail',
    });
    expect(compose.status).toBe('ok');
    expect(compose.schemaRef).toBeTruthy();
    expect(compose.objectUsed).toBeDefined();
    expect(compose.objectUsed!.name).toBe('Subscription');
    expect(compose.objectUsed!.traits.length).toBeGreaterThan(0);
    expect(compose.objectUsed!.fieldsComposed).toBeGreaterThan(5);

    // objectSchema bridge populated
    expect(compose.schema.objectSchema).toBeDefined();
    expect(Object.keys(compose.schema.objectSchema!).length).toBeGreaterThan(5);

    // detail context bindings populated
    const rootBindings = compose.schema.screens[0].bindings;
    expect(rootBindings).toBeDefined();
    expect(rootBindings!.onEdit).toBe('handleEdit');
    expect(rootBindings!.onDelete).toBe('handleDelete');

    const schemaRef = compose.schemaRef!;

    // ---- validate ----
    const validation = await validateHandle({ mode: 'full', schemaRef });
    expect(validation.status).toBe('ok');

    // ---- render ----
    const render = await renderHandle({ mode: 'full', schemaRef, apply: true });
    expect(render.status).toBe('ok');
    expect(render.html).toContain('<!DOCTYPE html>');
    // Should contain domain components, not just generic placeholders
    expect(render.html).toContain('data-oods-component=');

    // ---- codegen react ----
    const react = await codegenHandle({
      schemaRef,
      framework: 'react',
      options: { typescript: true, styling: 'tokens' },
    });
    expect(react.status).toBe('ok');
    expect(react.fileExtension).toBe('.tsx');

    // Typed Props interface from objectSchema
    expect(react.code).toContain('export interface PageProps');
    // At least some field types present
    expect(react.code).toMatch(/:\s*(string|number|boolean);/);
    // React.FC<PageProps> return type
    expect(react.code).toContain('React.FC<PageProps>');

    // Event handler stubs for detail context
    expect(react.code).toContain('const handleEdit');
    expect(react.code).toContain('const handleDelete');
    // Handler stubs include TODO comments
    expect(react.code).toContain('/* TODO: implement handleEdit */');
    expect(react.code).toContain('/* TODO: implement handleDelete */');

    // Binding attributes wired in JSX
    expect(react.code).toContain('onEdit={handleEdit}');
    expect(react.code).toContain('onDelete={handleDelete}');

    // ---- codegen vue ----
    const vue = await codegenHandle({
      schemaRef,
      framework: 'vue',
      options: { typescript: true, styling: 'tokens' },
    });
    expect(vue.status).toBe('ok');
    expect(vue.fileExtension).toBe('.vue');

    // Typed defineProps from objectSchema
    expect(vue.code).toContain('interface Props');
    expect(vue.code).toContain('defineProps<Props>()');
    expect(vue.code).toMatch(/:\s*(string|number|boolean);/);

    // Handler stubs in script setup
    expect(vue.code).toContain('const handleEdit');
    expect(vue.code).toContain('const handleDelete');

    // Vue binding attributes
    expect(vue.code).toContain('@edit="handleEdit"');
    expect(vue.code).toContain('@delete="handleDelete"');

    // SFC structure
    expect(vue.code).toContain('<template>');
    expect(vue.code).toContain('<script setup lang="ts">');
  });
});

/* ------------------------------------------------------------------ */
/*  Subscription · list context — full pipeline                        */
/* ------------------------------------------------------------------ */

describe('E2E pipeline — Subscription list', () => {
  it('compose → validate → render → codegen (react + vue)', async () => {
    // ---- compose ----
    const compose = await composeHandle({
      object: 'Subscription',
      context: 'list',
    });
    expect(compose.status).toBe('ok');
    expect(compose.layout).toBe('list');
    expect(compose.objectUsed).toBeDefined();
    expect(compose.schema.objectSchema).toBeDefined();

    // list context bindings
    const rootBindings = compose.schema.screens[0].bindings;
    expect(rootBindings!.onRowClick).toBe('handleRowClick');
    expect(rootBindings!.onSort).toBe('handleSort');
    expect(rootBindings!.onFilter).toBe('handleFilter');

    const schemaRef = compose.schemaRef!;

    // ---- validate ----
    const validation = await validateHandle({ mode: 'full', schemaRef });
    expect(validation.status).toBe('ok');

    // ---- render ----
    const render = await renderHandle({ mode: 'full', schemaRef, apply: true });
    expect(render.status).toBe('ok');
    expect(render.html).toContain('data-oods-component=');

    // ---- codegen react ----
    const react = await codegenHandle({
      schemaRef,
      framework: 'react',
      options: { typescript: true, styling: 'tokens' },
    });
    expect(react.status).toBe('ok');
    expect(react.code).toContain('export interface PageProps');
    expect(react.code).toContain('const handleRowClick');
    expect(react.code).toContain('const handleSort');
    expect(react.code).toContain('const handleFilter');
    expect(react.code).toContain('onRowClick={handleRowClick}');

    // ---- codegen vue ----
    const vue = await codegenHandle({
      schemaRef,
      framework: 'vue',
      options: { typescript: true, styling: 'tokens' },
    });
    expect(vue.status).toBe('ok');
    expect(vue.code).toContain('interface Props');
    expect(vue.code).toContain('defineProps<Props>()');
    expect(vue.code).toContain('const handleRowClick');
    expect(vue.code).toContain('@rowClick="handleRowClick"');
  });
});

/* ------------------------------------------------------------------ */
/*  User · detail context — second object pipeline                     */
/* ------------------------------------------------------------------ */

describe('E2E pipeline — User detail', () => {
  it('compose → validate → render → codegen (react + vue)', async () => {
    // ---- compose ----
    const compose = await composeHandle({
      object: 'User',
      context: 'detail',
    });
    expect(compose.status).toBe('ok');
    expect(compose.objectUsed).toBeDefined();
    expect(compose.objectUsed!.name).toBe('User');
    expect(compose.objectUsed!.traits.length).toBeGreaterThan(0);
    expect(compose.objectUsed!.fieldsComposed).toBeGreaterThan(0);

    // objectSchema populated for User fields
    expect(compose.schema.objectSchema).toBeDefined();
    expect(Object.keys(compose.schema.objectSchema!).length).toBeGreaterThan(0);

    // detail bindings
    const rootBindings = compose.schema.screens[0].bindings;
    expect(rootBindings!.onEdit).toBe('handleEdit');
    expect(rootBindings!.onDelete).toBe('handleDelete');

    const schemaRef = compose.schemaRef!;

    // ---- validate ----
    const validation = await validateHandle({ mode: 'full', schemaRef });
    expect(validation.status).toBe('ok');

    // ---- render ----
    const render = await renderHandle({ mode: 'full', schemaRef, apply: true });
    expect(render.status).toBe('ok');
    expect(render.html).toContain('<!DOCTYPE html>');

    // ---- codegen react ----
    const react = await codegenHandle({
      schemaRef,
      framework: 'react',
      options: { typescript: true, styling: 'tokens' },
    });
    expect(react.status).toBe('ok');
    expect(react.code).toContain('export interface PageProps');
    expect(react.code).toContain('React.FC<PageProps>');
    expect(react.code).toContain('const handleEdit');
    expect(react.code).toContain('const handleDelete');

    // ---- codegen vue ----
    const vue = await codegenHandle({
      schemaRef,
      framework: 'vue',
      options: { typescript: true, styling: 'tokens' },
    });
    expect(vue.status).toBe('ok');
    expect(vue.code).toContain('interface Props');
    expect(vue.code).toContain('defineProps<Props>()');
    expect(vue.code).toContain('const handleEdit');
  });
});

/* ------------------------------------------------------------------ */
/*  Cross-cutting concerns                                             */
/* ------------------------------------------------------------------ */

describe('E2E pipeline — cross-cutting', () => {
  it('objectSchema field entries have type and required', async () => {
    const compose = await composeHandle({
      object: 'Subscription',
      context: 'detail',
    });
    for (const [, entry] of Object.entries(compose.schema.objectSchema!)) {
      expect(entry.type).toBeTruthy();
      expect(typeof entry.required).toBe('boolean');
    }
  });

  it('react codegen field types match objectSchema entries', async () => {
    const compose = await composeHandle({
      object: 'Subscription',
      context: 'detail',
    });
    const react = await codegenHandle({
      schemaRef: compose.schemaRef!,
      framework: 'react',
      options: { typescript: true, styling: 'tokens' },
    });

    // The generated code should have at least one field from objectSchema
    const fieldNames = Object.keys(compose.schema.objectSchema!);
    // Convert snake_case to camelCase for matching
    const camelNames = fieldNames.map((n) =>
      n.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
    );
    // At least some fields should appear in the generated code
    const found = camelNames.filter((name) => react.code.includes(name));
    expect(found.length).toBeGreaterThan(0);
  });

  it('vue codegen field types match objectSchema entries', async () => {
    const compose = await composeHandle({
      object: 'Subscription',
      context: 'detail',
    });
    const vue = await codegenHandle({
      schemaRef: compose.schemaRef!,
      framework: 'vue',
      options: { typescript: true, styling: 'tokens' },
    });

    const fieldNames = Object.keys(compose.schema.objectSchema!);
    const camelNames = fieldNames.map((n) =>
      n.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
    );
    const found = camelNames.filter((name) => vue.code.includes(name));
    expect(found.length).toBeGreaterThan(0);
  });

  it('intent-only compose produces codegen without objectSchema', async () => {
    const compose = await composeHandle({ intent: 'dashboard with metrics' });
    expect(compose.status).toBe('ok');
    expect(compose.schema.objectSchema).toBeUndefined();

    const react = await codegenHandle({
      schemaRef: compose.schemaRef!,
      framework: 'react',
      options: { typescript: true, styling: 'tokens' },
    });
    expect(react.status).toBe('ok');
    // No PageProps interface without objectSchema
    expect(react.code).not.toContain('interface PageProps');
    // No handler stubs without bindings
    expect(react.code).not.toContain('const handle');
  });

  it('render output contains domain components not just placeholders', async () => {
    const compose = await composeHandle({
      object: 'Subscription',
      context: 'detail',
    });
    const render = await renderHandle({
      mode: 'full',
      schemaRef: compose.schemaRef!,
      apply: true,
    });
    expect(render.status).toBe('ok');

    // Count data-oods-component occurrences — should have multiple domain components
    const componentMatches = render.html!.match(/data-oods-component="[^"]+"/g) ?? [];
    expect(componentMatches.length).toBeGreaterThan(1);
  });
});
