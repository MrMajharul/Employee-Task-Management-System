const http = require('http');

const base = 'http://localhost:' + (process.env.PORT || 3002);

function get(path, headers = {}) {
  return new Promise((resolve) => {
    const req = http.get(base + path, { headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', (err) => resolve({ status: 0, body: err.message }));
  });
}

function post(path, body, headers = {}) {
  return new Promise((resolve) => {
    const url = new URL(base + path);
    const payload = JSON.stringify(body || {});
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', (err) => resolve({ status: 0, body: err.message }));
    req.write(payload);
    req.end();
  });
}

(async () => {
  const health = await get('/health');
  console.log('health', health.status);

  const login = await post('/api/login', { username: 'admin', password: 'password' });
  console.log('login', login.status);
  let token = '';
  try {
    token = JSON.parse(login.body).token || '';
  } catch (e) {}
  if (!token) {
    console.log('No token; cannot continue');
    process.exit(1);
  }
  const auth = { Authorization: 'Bearer ' + token };

  const endpoints = [
    '/api/reports/summary',
    '/api/reports/users-performance',
    '/api/reports/workload',
    '/api/reports/strings',
    '/api/reports/setops',
  ];
  for (const ep of endpoints) {
    const r = await get(ep, auth);
    console.log(ep, r.status, (r.body || '').slice(0, 120));
  }
})();
