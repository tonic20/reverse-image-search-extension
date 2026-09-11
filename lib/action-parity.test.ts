// Enforces that the two independent copies of the entry-point action list —
// ClientAction::ACTIONS on the server and SEARCH_ACTIONS here — agree exactly,
// in the same order. Nothing else checks this: add a 12th action to only one
// side and the server silently stores NULL for it (or drops a value the
// client sends), and the dashboard reads that as "nobody uses this feature"
// rather than "these two lists drifted".
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { SEARCH_ACTIONS } from './telemetry';

const CLIENT_ACTION_PATH = path.join(
  import.meta.dirname,
  '../../backend/app/services/client_action.rb',
);
// backend/ is private and does not exist in the public mirror, a subtree split
// of extension/ alone. Skip rather than fail there — same guard as
// menu-label-parity.test.ts.
const HAS_BACKEND = existsSync(CLIENT_ACTION_PATH);

/** Pulls the words out of a Ruby `%w[...]` literal. */
function words(literal: string): string[] {
  const match = literal.match(/%w\[([^\]]*)\]/);
  if (!match) throw new Error(`not a %w[...] literal: ${literal}`);
  return match[1].split(/\s+/).filter(Boolean);
}

/** Reconstructs ClientAction::ACTIONS from the Ruby source, in order. */
function serverActions(): string[] {
  const source = readFileSync(CLIENT_ACTION_PATH, 'utf8');

  const engineIds = source.match(/ENGINE_IDS\s*=\s*(%w\[[^\]]*\])/);
  if (!engineIds) throw new Error('ENGINE_IDS not found in client_action.rb');

  // DIRECT = (ENGINE_IDS.map { |id| "direct_#{id}" } + %w[direct_all direct_face]).freeze
  const direct = source.match(/DIRECT\s*=\s*\(ENGINE_IDS\.map.*?\+\s*(%w\[[^\]]*\])\)/s);
  if (!direct) throw new Error('DIRECT not found in client_action.rb');

  const upload = source.match(/UPLOAD\s*=\s*(%w\[[^\]]*\])/);
  if (!upload) throw new Error('UPLOAD not found in client_action.rb');

  return [
    ...words(engineIds[1]).map((id) => `direct_${id}`),
    ...words(direct[1]),
    ...words(upload[1]),
  ];
}

describe.skipIf(!HAS_BACKEND)('action parity', () => {
  it('matches ClientAction::ACTIONS exactly, in the same order', () => {
    expect(SEARCH_ACTIONS).toEqual(serverActions());
  });
});
