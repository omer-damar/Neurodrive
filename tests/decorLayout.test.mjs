import { test } from 'node:test';
import assert from 'node:assert/strict';

import { planDecor, decorRadius, distanceToCentreLine, DECOR_KINDS } from '../src/ui/three/decorLayout.js';
import { Track, PRESETS } from '../src/core/track.js';

for (const name of Object.keys(PRESETS)) {
  test(`decor on "${name}" stays off the road and items do not overlap`, () => {
    const track = Track.preset(name);
    const items = planDecor(track);
    const half = track.width / 2;
    for (const item of items) {
      assert.ok(DECOR_KINDS[item.kind], `unknown kind ${item.kind}`);
      const clearance = distanceToCentreLine(track, item.x, item.y) - half;
      // Start flags sit closer on purpose; everything else clears the road by its own radius.
      const needed = item.kind === 'flagCheckers' ? 0 : decorRadius(item.kind);
      assert.ok(clearance > needed, `${item.kind} at ${item.x.toFixed(0)},${item.y.toFixed(0)} is on the road`);
    }
    const placed = items.filter((i) => i.kind !== 'flagCheckers');
    for (let a = 0; a < placed.length; a++) {
      for (let b = a + 1; b < placed.length; b++) {
        const d = Math.hypot(placed[a].x - placed[b].x, placed[a].y - placed[b].y);
        assert.ok(d >= decorRadius(placed[a].kind) + decorRadius(placed[b].kind), `${placed[a].kind} overlaps ${placed[b].kind}`);
      }
    }
  });
}

test('decor has grandstands, start flags and plenty of trees', () => {
  const items = planDecor(Track.preset('classic'));
  const count = (kind) => items.filter((i) => i.kind === kind).length;
  assert.equal(count('flagCheckers'), 2);
  assert.ok(count('grandStand') + count('grandStandCovered') >= 2);
  assert.ok(count('treeLarge') + count('treeSmall') >= 30);
});

test('the same track and seed give the same layout', () => {
  const track = Track.preset('technical');
  assert.deepEqual(planDecor(track, 3), planDecor(track, 3));
  assert.notDeepEqual(planDecor(track, 3), planDecor(track, 4));
});

test('stands face the road', () => {
  const track = Track.preset('oval');
  for (const item of planDecor(track).filter((i) => i.kind.startsWith('grandStand'))) {
    const ahead = distanceToCentreLine(track, item.x + Math.cos(item.angle) * 40, item.y + Math.sin(item.angle) * 40);
    assert.ok(ahead < distanceToCentreLine(track, item.x, item.y), 'front points away from the track');
  }
});
