import index from '../src/index.js';

const event = {};
const env = {};
const ctx = { waitUntil: (promise) => promise };

(async () => {
  await index.scheduled(event, env, ctx);
})();
