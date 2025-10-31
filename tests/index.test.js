import index from '../src/index.ts';

const controller = {
  cron: '* * * * *',
  scheduledTime: Date.now(),
  type: 'scheduled'
};
const env = {};
const ctx = { waitUntil: (promise) => promise };

(async () => {
  await index.scheduled(controller, env, ctx);
})();
