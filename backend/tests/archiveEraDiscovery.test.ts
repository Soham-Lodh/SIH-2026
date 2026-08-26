import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFilteredIndiaArchive } from '../server/aiGateway';

test('1990s archive filter returns era-discovered disasters without requiring RSS citations', async () => {
  const items = await buildFilteredIndiaArchive(3, { decadeFilter: '1990s' });

  assert.ok(items.length > 0);
  assert.ok(items.every((item) => item.decade === '1990s'));
  assert.ok(items.every((item) => item.eventDate));
});
