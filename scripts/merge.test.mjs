import { test } from 'node:test';
import assert from 'node:assert/strict';
import { merge, render } from './merge.mjs';

const up = () => ({
  claude: [
    { id: 'claude-sonnet-5-5', display_name: 'Sonnet 5.5', context_length: 1 },
    { id: 'claude-opus-5-5', display_name: 'Opus 5.5', context_length: 1 },
  ],
  codex: [{ id: 'gpt-6-astra' }],
});

test('appends an id upstream lacks at the end of its section', () => {
  const { catalog, added, kept } = merge(up(), { claude: [{ id: 'claude-haiku-5-5', display_name: 'Haiku 5.5' }] });
  assert.deepEqual(catalog.claude.map((e) => e.id), ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5']);
  assert.deepEqual(added, ['claude/claude-haiku-5-5']);
  assert.deepEqual(kept, []);
});

test('upstream wins when it carries the id, even if the overlay entry differs', () => {
  const { catalog, added, kept } = merge(up(), { claude: [{ id: 'claude-sonnet-5-5', display_name: 'CHANGED', context_length: 999 }] });
  assert.deepEqual(catalog.claude[0], { id: 'claude-sonnet-5-5', display_name: 'Sonnet 5.5', context_length: 1 });
  assert.equal(catalog.claude.length, 2);
  assert.deepEqual(added, []);
  assert.deepEqual(kept, ['claude/claude-sonnet-5-5']);
});

test('sections the overlay does not name pass through verbatim and the input is not mutated', () => {
  const input = up();
  const { catalog } = merge(input, { claude: [{ id: 'x' }] });
  assert.deepEqual(catalog.codex, up().codex);
  assert.deepEqual(input, up());
});

test('a provider section absent upstream is created', () => {
  const { catalog } = merge(up(), { meta: [{ id: 'llama-9' }] });
  assert.deepEqual(catalog.meta, [{ id: 'llama-9' }]);
});

test('merge is idempotent', () => {
  const overlay = { claude: [{ id: 'claude-haiku-5-5' }] };
  const once = merge(up(), overlay).catalog;
  const twice = merge(once, overlay);
  assert.deepEqual(twice.catalog, once);
  assert.deepEqual(twice.added, []);
});

test('rejects an overlay entry without an id and a non-array section', () => {
  assert.throws(() => merge(up(), { claude: [{ display_name: 'no id' }] }), /non-empty string id/);
  assert.throws(() => merge(up(), { claude: { id: 'x' } }), /must be an array/);
});

test('render is 2-space JSON with a trailing newline', () => {
  assert.equal(render({ a: [1] }), '{\n  "a": [\n    1\n  ]\n}\n');
});
