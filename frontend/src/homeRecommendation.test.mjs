import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendNext } from './homeRecommendation.js';
import { talkShare, turnStats, wordCount } from './speakingStats.js';

const now = new Date(2026, 10, 8, 12);
const incomplete = { complete: false, remaining: 2 };
const complete = { complete: true, remaining: 0 };

test('recommends a first conversation when there is no activity', () => {
  assert.equal(recommendNext({ progress: incomplete, now }).id, 'first-conversation');
  // An unspoken conversation does not count as activity.
  assert.equal(recommendNext({ sessions: [{ has_spoken: false, created_at: now.toISOString() }], progress: incomplete, now }).id, 'first-conversation');
});

test('alternates with the last speaking activity while the goal is open', () => {
  const sessions = [{ has_spoken: true, created_at: new Date(2026, 10, 7).toISOString() }];
  const olderSpeech = [{ created_at: new Date(2026, 10, 5).toISOString() }];
  const newerSpeech = [{ created_at: new Date(2026, 10, 8, 9).toISOString() }];
  const afterConversation = recommendNext({ sessions, speeches: olderSpeech, progress: incomplete, now });
  assert.equal(afterConversation.id, 'surprise-topic');
  assert.equal(afterConversation.mode, 'impromptu');
  assert.match(afterConversation.detail, /2 more practices reach/);
  assert.equal(recommendNext({ sessions, speeches: newerSpeech, progress: incomplete, now }).id, 'conversation');
  assert.match(recommendNext({ sessions, speeches: newerSpeech, progress: { complete: false, remaining: 1 }, now }).detail, /1 more practice reaches/);
});

test('suggests the journal once the goal is reached, then a bonus conversation', () => {
  const sessions = [{ has_spoken: true, created_at: now.toISOString() }];
  assert.equal(recommendNext({ sessions, journalEntries: [{ created_at: new Date(2026, 10, 7).toISOString() }], progress: complete, now }).id, 'journal');
  assert.equal(recommendNext({ sessions, journalEntries: [{ created_at: new Date(2026, 10, 8, 8).toISOString() }], progress: complete, now }).id, 'bonus-conversation');
});

test('speaking stats count words, pace and talk share', () => {
  assert.equal(wordCount("I've been to Bali — twice!"), 5);
  assert.deepEqual(turnStats('one two three four five six', 6), { words: 6, wpm: 60 });
  assert.deepEqual(turnStats('hi there', 2), { words: 2, wpm: null });
  assert.deepEqual(talkShare([{ role: 'assistant', content: 'a b' }, { role: 'user', content: 'c d e f g h' }]), { you: 75, partner: 25, total: 8 });
  assert.deepEqual(talkShare([]), { you: 0, partner: 0, total: 0 });
});
