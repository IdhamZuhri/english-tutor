import { readFile } from 'node:fs/promises';
import path from 'node:path';

// All app data lives in Firestore. The server keeps it in memory as one object and calls save()
// after each change; only the documents that changed are written back.
export const COLLECTIONS = ['sessions', 'practiceAttempts', 'speeches', 'journalEntries'];
const AUDIO_COLLECTION = 'journalAudio';
const AUDIO_CHUNK_BYTES = 900_000; // Firestore documents are limited to 1 MiB.
const emptyStore = () => ({ nextId: 1, sessions: [], practiceAttempts: [], speeches: [], journalEntries: [] });

// Tests pass an in-memory database here instead of connecting to a real project.
let databaseOverride = null;
export function useDatabaseForTests(db) { databaseOverride = db; }

// Runs saves one after another; a failed save is reported to its caller but never blocks later saves.
function serial(write) {
  let chain = Promise.resolve();
  return () => {
    const run = chain.then(write);
    chain = run.catch(() => {});
    return run;
  };
}

// Records with an id are stored under that id; practice attempts have no id and are only ever
// appended, so their position is used instead (zero-padded so documents sort in order).
const docId = (name, item, index) => name !== 'practiceAttempts' && item?.id !== undefined ? String(item.id) : String(index).padStart(8, '0');

async function connect({ projectId, databaseId, credentialsPath }) {
  let appModule, firestoreModule;
  try {
    [appModule, firestoreModule] = await Promise.all([import('firebase-admin/app'), import('firebase-admin/firestore')]);
  } catch {
    throw new Error('firebase-admin is not installed. Run "npm install" in the project root.');
  }
  const { initializeApp, applicationDefault, cert, getApps } = appModule;
  let credential;
  if (credentialsPath) {
    let key;
    try { key = JSON.parse(await readFile(credentialsPath, 'utf8')); }
    catch (error) {
      throw new Error(`Could not read the Firebase service account key at ${credentialsPath} (${error.code || error.message}). Download it from Firebase console → Project settings → Service accounts → Generate new private key, and save it at that path.`);
    }
    if (key.project_id && key.project_id !== projectId) throw new Error(`The service account key is for project "${key.project_id}", but FIRESTORE_PROJECT_ID is "${projectId}".`);
    credential = cert(key);
  } else credential = applicationDefault();
  const app = getApps().find(item => item.name === 'speakwell') || initializeApp({ projectId, credential }, 'speakwell');
  const db = databaseId ? firestoreModule.getFirestore(app, databaseId) : firestoreModule.getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

// Keeps the in-memory store in sync with a Firestore database (passed in so it can be tested).
export async function createFirestoreStorage(db) {
  const metaRef = db.collection('meta').doc('app');

  // Load everything into memory, remembering what each document looked like when loaded.
  const saved = new Map();
  const store = emptyStore();
  const [meta, ...snapshots] = await Promise.all([metaRef.get(), ...COLLECTIONS.map(name => db.collection(name).get())]);
  COLLECTIONS.forEach((name, i) => {
    const docs = snapshots[i].docs.sort((a, b) => name === 'practiceAttempts' ? a.id.localeCompare(b.id) : (Number(a.data().id) || 0) - (Number(b.data().id) || 0));
    store[name] = docs.map(doc => doc.data());
    store[name].forEach((item, index) => saved.set(`${name}/${docId(name, item, index)}`, JSON.stringify(item)));
  });
  store.nextId = Number(meta.exists && meta.data().nextId) || 1;
  saved.set('meta/app', JSON.stringify({ nextId: store.nextId }));

  const save = serial(async () => {
    const writes = [];
    for (const name of COLLECTIONS) {
      store[name].forEach((item, index) => {
        const id = docId(name, item, index);
        const json = JSON.stringify(item);
        if (saved.get(`${name}/${id}`) !== json) writes.push({ key: `${name}/${id}`, json, ref: db.collection(name).doc(id), data: item });
      });
    }
    const metaJson = JSON.stringify({ nextId: store.nextId });
    if (saved.get('meta/app') !== metaJson) writes.push({ key: 'meta/app', json: metaJson, ref: metaRef, data: { nextId: store.nextId } });
    for (let i = 0; i < writes.length; i += 450) {
      const chunk = writes.slice(i, i + 450);
      const batch = db.batch();
      chunk.forEach(write => batch.set(write.ref, write.data));
      await batch.commit();
      chunk.forEach(write => saved.set(write.key, write.json));
    }
  });

  // Journal recordings are split into chunks so each stays under the document size limit.
  const saveAudio = async (name, buffer, type) => {
    const chunks = Math.max(1, Math.ceil(buffer.length / AUDIO_CHUNK_BYTES));
    const batch = db.batch();
    batch.set(db.collection(AUDIO_COLLECTION).doc(name), { type, size: buffer.length, chunks, created_at: new Date().toISOString() });
    for (let index = 0; index < chunks; index++) {
      batch.set(db.collection(AUDIO_COLLECTION).doc(`${name}#${index}`), { data: buffer.subarray(index * AUDIO_CHUNK_BYTES, (index + 1) * AUDIO_CHUNK_BYTES) });
    }
    await batch.commit();
  };
  const readAudio = async name => {
    const head = await db.collection(AUDIO_COLLECTION).doc(name).get();
    if (!head.exists) return null;
    const { type, chunks } = head.data();
    const parts = await Promise.all(Array.from({ length: chunks }, (_, index) => db.collection(AUDIO_COLLECTION).doc(`${name}#${index}`).get()));
    if (parts.some(part => !part.exists)) return null;
    return { type, buffer: Buffer.concat(parts.map(part => Buffer.from(part.data().data))) };
  };

  return { kind: 'firestore', store, save, saveAudio, readAudio };
}

export async function openStorage({ baseDir }) {
  if (databaseOverride) return { ...(await createFirestoreStorage(databaseOverride)), projectId: 'test' };
  const projectId = process.env.FIRESTORE_PROJECT_ID?.trim();
  if (!projectId) throw new Error('FIRESTORE_PROJECT_ID is not set. SpeakWell stores all data in Firestore; add it and GOOGLE_APPLICATION_CREDENTIALS to backend/.env (see backend/.env.example).');
  const rawPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const db = await connect({
    projectId,
    databaseId: process.env.FIRESTORE_DATABASE_ID?.trim() || '',
    credentialsPath: rawPath ? path.resolve(baseDir, rawPath) : '',
  });
  return { ...(await createFirestoreStorage(db)), projectId };
}
