(async () => {
  try {
    const base = 'http://localhost:3002/api';
    const headers = { 'Content-Type': 'application/json' };
    const loginRes = await fetch(base + '/login', { method: 'POST', headers, body: JSON.stringify({ username: 'admin', password: 'password' }) });
    const loginJson = await loginRes.json().catch(() => ({}));
    console.log('Login status:', loginRes.status, loginJson.user ? `user=${loginJson.user.username}` : loginJson.error || '');
    if (!loginRes.ok) process.exit(1);
    const token = loginJson.token;

    const projRes = await fetch(base + '/projects', { headers: { Authorization: 'Bearer ' + token } });
    const text = await projRes.text();
    console.log('Projects status:', projRes.status);
    console.log(text);
    if (!projRes.ok) process.exit(2);
  } catch (e) {
    console.error('Test error:', e.message);
    process.exit(3);
  }
})();
