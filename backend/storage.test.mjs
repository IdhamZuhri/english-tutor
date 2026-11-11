import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createFirestoreStorage } from './storage.mjs';

// Minimal in-memory stand-in for the parts of the Firestore Admin API the storage layer uses.
function fakeFirestore(initial = {}) {
  const data = new Map(Object.entries(initial));
  const writes = [];
  const doc = (collection, id) => ({
    path: `${collection}/${id}`,
    async get() { const value = data.get(`${collection}/${id}`); return { exists: value !== undefined, data: () => structuredClone(value) }; },
  });
  return {
    data,
    writes,
    collection: name => ({
      doc: id => doc(name, id),
      async get() {
        const docs = [...data.entries()].filter(([key]) => key.startsWith(`${name}/`)).map(([key, value]) => ({ id: key.slice(name.length + 1), data: () => structuredClone(value) }));
        return { docs };
      },
    }),
    batch() {
      const pending = [];
      return {
        set(ref, value) { pending.push([ref.path, structuredClone(value)]); },
        async commit() { for (const [key, value] of pending) { data.set(key, value); writes.push(key); } },
      };
    },
  };
}

test('firestore storage loads, writes only changed documents, and keeps ids in order', async () => {
  const db = fakeFirestore({
    'meta/app': { nextId: 12 },
    'speeches/10': { id: 10, title: 'Ten' },
    'speeches/2': { id: 2, title: 'Two' },
    'practiceAttempts/00000000': { category: 'Grammar', correct: true },
  });
  const storage = await createFirestoreStorage(db, null);
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

test('firestore storage copies local data into an empty project once', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'speakwell-storage-'));
  const dataFile = path.join(dir, 'sessions.json');
  await writeFile(dataFile, JSON.stringify({ nextId: 4, sessions: [{ id: 1, topic: 'Food', history: [] }], practiceAttempts: [], speeches: [{ id: 3, title: 'Garden' }], journalEntries: [] }));
  const db = fakeFirestore();
  const storage = await createFirestoreStorage(db, dataFile);
  assert.deepEqual(storage.migrated, { sessions: 1, practiceAttempts: 0, speeches: 1, journalEntries: 0 });
  assert.equal(db.data.get('sessions/1').topic, 'Food');
  assert.equal(db.data.get('meta/app').nextId, 4);

  const again = await createFirestoreStorage(db, dataFile);
  assert.equal(again.migrated, undefined, 'a project that already has data is never overwritten');
});
