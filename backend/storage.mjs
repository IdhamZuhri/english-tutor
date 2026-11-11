import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

// The app keeps all data in memory as one object and calls save() after each change.
// This module persists that object either to a local JSON file (default) or to Firestore.
export const COLLECTIONS = ['sessions', 'practiceAttempts', 'speeches', 'journalEntries'];
const emptyStore = () => ({ nextId: 1, sessions: [], practiceAttempts: [], speeches: [], journalEntries: [] });

function normalize(data) {
  const store = { ...emptyStore(), ...data };
  for (const name of COLLECTIONS) if (!Array.isArray(store[name])) store[name] = [];
  store.nextId = Number(store.nextId) || 1;
  return store;
}

async function readLocal(dataFile) {
  try {
    const data = JSON.parse(await readFile(dataFile, 'utf8'));
    if (!Array.isArray(data.sessions)) throw new Error(`Invalid session store in ${dataFile}`);
    return normalize(data);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// Runs saves one after another; a failed save is reported to its caller but never blocks later saves.
function serial(write) {
  let chain = Promise.resolve();
  return () => {
    const run = chain.then(write);
    chain = run.catch(() => {});
    return run;
  };
}

function localStorage(dataFile, store) {
  return {
    kind: 'local',
    store,
    save: serial(async () => {
      const snapshot = JSON.stringify(store, null, 2);
      await mkdir(path.dirname(dataFile), { recursive: true });
      const temp = `${dataFile}.tmp`;
      await writeFile(temp, snapshot);
      await rename(temp, dataFile);
    }),
  };
}

// Records with an id are stored under that id; practice attempts have no id and are only ever
// appended, so their position is used instead (zero-padded so documents sort in order).
const docId = (name, item, index) => name !== 'practiceAttempts' && item?.id !== undefined ? String(item.id) : String(index).padStart(8, '0');

async function firestoreStorage({ projectId, databaseId, credentialsPath, dataFile }) {
  let appModule, firestoreModule;
  try {
    [appModule, firestoreModule] = await Promise.all([import('firebase-admin/app'), import('firebase-admin/firestore')]);
  } catch {
    throw new Error('FIRESTORE_PROJECT_ID is set but firebase-admin is not installed. Run "npm install" in the project root.');
  }
  const { initializeApp, applicationDefault, cert, getApps } = appModule;
  const { getFirestore } = firestoreModule;
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
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  return { ...(await createFirestoreStorage(db, dataFile)), projectId };
}

// Keeps the in-memory store in sync with a Firestore database (passed in so it can be tested).
export async function createFirestoreStorage(db, dataFile) {
  const metaRef = db.collection('meta').doc('app');

  // Load everything into memory, remembering what each document looked like when loaded.
  const saved = new Map();
  const store = emptyStore();
  const [meta, ...snapshots] = await Promise.all([metaRef.get(), ...COLLECTIONS.map(name => db.collection(name).get())]);
  COLLECTIONS.forEach((name, i) => {
    const docs = snapshots[i].docs.sort((a, b) => {
      const left = a.data(), right = b.data();
      return name === 'practiceAttempts' ? a.id.localeCompare(b.id) : (Number(left.id) || 0) - (Number(right.id) || 0);
    });
    store[name] = docs.map(doc => doc.data());
    store[name].forEach((item, index) => saved.set(`${name}/${docId(name, item, index)}`, JSON.stringify(item)));
  });
  store.nextId = Number(meta.exists && meta.data().nextId) || 1;
  saved.set('meta/app', JSON.stringify({ nextId: store.nextId }));

  const save = serial(async () => {
    const writes = [];
    for (const name of COLLECTIONS) {
      store[name].forEach((item, index) => {
        const key = `${name}/${docId(name, item, index)}`;
        const json = JSON.stringify(item);
        if (saved.get(key) !== json) writes.push({ key, json, ref: db.collection(name).doc(key.split('/')[1]), data: item });
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

  const storage = { kind: 'firestore', store, save };

  // First run against an empty Firestore project: copy existing local data up once.
  const isEmpty = COLLECTIONS.every(name => store[name].length === 0) && !meta.exists;
  const local = isEmpty && dataFile ? await readLocal(dataFile) : null;
  if (local && COLLECTIONS.some(name => local[name].length)) {
    Object.assign(store, local);
    await save();
    storage.migrated = Object.fromEntries(COLLECTIONS.map(name => [name, local[name].length]));
  }
  return storage;
}

export async function openStorage({ dataFile, baseDir }) {
  const projectId = process.env.FIRESTORE_PROJECT_ID?.trim();
  if (!projectId) return localStorage(dataFile, (await readLocal(dataFile)) || emptyStore());
  const rawPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  return firestoreStorage({
    projectId,
    databaseId: process.env.FIRESTORE_DATABASE_ID?.trim() || '',
    credentialsPath: rawPath ? path.resolve(baseDir, rawPath) : '',
    dataFile,
  });
}
