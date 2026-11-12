import test from 'node:test';
import assert from 'node:assert/strict';
import { createFirestoreStorage } from './storage.mjs';
import { fakeFirestore } from './fakeFirestore.mjs';

test('firestore storage loads, writes only changed documents, and keeps ids in order', async () => {
  const db = fakeFirestore({
    'meta/app': { nextId: 12 },
    'speeches/10': { id: 10, title: 'Ten' },
    'speeches/2': { id: 2, title: 'Two' },
    'practiceAttempts/00000000': { category: 'Grammar', correct: true },
  });
  const storage = await createFirestoreStorage(db);
  assert.equal(storage.kind, 'firestore');
  assert.deepEqual(storage.store.speeches.map(item => item.id), [2, 10]);
  assert.equal(storage.store.nextId, 12);

  await storage.save();
  assert.deepEqual(db.writes, [], 'unchanged data should not be rewritten');

  storage.store.speeches[0].title = 'Two (edited)';
  storage.store.sessions.push({ id: storage.store.nextId++, topic: 'Travel', history: [{ role: 'assistant', content: 'Hi' }] });
  storage.store.practiceAttempts.push({ category: 'Vocabulary', correct: false });
  await storage.save();
  assert.deepEqual(db.writes.sort(), ['meta/app', 'practiceAttempts/00000001', 'sessions/12', 'speeches/2']);
  assert.equal(db.data.get('speeches/2').title, 'Two (edited)');
  assert.equal(db.data.get('meta/app').nextId, 13);
});
