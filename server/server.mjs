// Stub API for the EchoRent flow. It serves the same fake cars as the UI
// (shared/cars.json), so it shows the response shape for the real backend.
// ponytail: zero dependencies on purpose; replace this file with the real
// backend when Tenzy ships it.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const cars = JSON.parse(
  await readFile(new URL('../shared/cars.json', import.meta.url), 'utf8'),
);
const locations = JSON.parse(
  await readFile(new URL('../shared/locations.json', import.meta.url), 'utf8'),
);

createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  const [path, query] = (req.url ?? '').split('?');
  if (path === '/api/cars') {
    const airport = new URLSearchParams(query).get('airport');
    if (!airport) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'airport is required' }));
    } else if (!cars[airport]) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'unknown airport' }));
    } else {
      res.end(JSON.stringify(cars[airport]));
    }
  } else if (path === '/api/locations') {
    res.end(JSON.stringify(locations));
  } else if (path === '/api/voice/token') {
    // The real backend creates a temporary token with the AssemblyAI API and
    // returns the id of the stored agent. This stub shows that response shape.
    res.end(JSON.stringify({ token: 'stub-token', agent_id: 'stub-agent' }));
  } else if (path === '/api/health') {
    res.end(JSON.stringify({ ok: true }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found' }));
  }
}).listen(8787, () => {
  console.log('EchoRent stub API on http://localhost:8787');
});
