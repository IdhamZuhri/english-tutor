// Minimal in-memory stand-in for the parts of the Firestore Admin API that storage.mjs uses.
// For tests only.
export function fakeFirestore(initial = {}) {
  const data = new Map(Object.entries(initial));
  const writes = [];
  const clone = value => structuredClone(value);
  const doc = (collection, id) => ({
    path: `${collection}/${id}`,
    async get() { const value = data.get(`${collection}/${id}`); return { exists: value !== undefined, data: () => clone(value) }; },
  });
  return {
    data,
    writes,
    collection: name => ({
      doc: id => doc(name, id),
      async get() {
        const docs = [...data.entries()]
          .filter(([key]) => key.startsWith(`${name}/`))
          .map(([key, value]) => ({ id: key.slice(name.length + 1), data: () => clone(value) }));
        return { docs };
      },
    }),
    batch() {
      const pending = [];
      return {
        set(ref, value) { pending.push([ref.path, clone(value)]); },
        async commit() { for (const [key, value] of pending) { data.set(key, value); writes.push(key); } },
      };
    },
  };
}
