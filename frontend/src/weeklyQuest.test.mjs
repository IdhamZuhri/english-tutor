import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklySpeakingProgress } from './weeklyQuest.js';

test('counts only spoken conversations and reviewed speeches in the local Monday-to-Sunday week', () => {
  const now = new Date(2026, 9, 24, 12); // Saturday
  const sessions = [
    { has_spoken: false, created_at: new Date(2026, 9, 21, 10).toISOString() },
    { has_spoken: true, created_at: new Date(2026, 9, 18, 10).toISOString(), last_spoke_at: new Date(2026, 9, 22, 10).toISOString() },
    { has_spoken: true, created_at: new Date(2026, 9, 18, 10).toISOString() },
  ];
  const speeches = [
    { created_at: new Date(2026, 9, 19, 0).toISOString() },
    { created_at: new Date(2026, 9, 25, 23, 59).toISOString() },
    { created_at: new Date(2026, 9, 26, 0).toISOString() },
  ];
  assert.deepEqual(weeklySpeakingProgress(sessions, speeches, 3, now), { count: 3, goal: 3, remaining: 0, complete: true });
  assert.deepEqual(weeklySpeakingProgress(sessions, speeches, 5, now), { count: 3, goal: 5, remaining: 2, complete: false });
});
