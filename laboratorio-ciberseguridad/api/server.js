const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const path = require('node:path');
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '8kb' }));
const { JWT_SECRET, ADMIN_PASSWORD, USER_PASSWORD } = process.env;
if (!JWT_SECRET || Buffer.byteLength(JWT_SECRET) < 32 ||
    !ADMIN_PASSWORD || !USER_PASSWORD || ADMIN_PASSWORD === USER_PASSWORD) {
  throw new Error('Define un secreto de 32 bytes y dos contraseñas de prueba distintas.');
}
function same(a, b) {
  const digest = value => crypto.createHash('sha256').update(String(value)).digest();
  return crypto.timingSafeEqual(digest(a), digest(b));
}
function authenticate(req, res, next) {
  const match = /^Bearer ([^ ]+)$/.exec(req.get('authorization') || '');
  if (!match) return res.status(401).json({ error: 'Token requerido' });
  try {
    req.auth = jwt.verify(match[1], JWT_SECRET, {
      algorithms: ['HS256'], issuer: 'laboratorio-local', audience: 'api-local'
    });
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o vencido' });
  }
}
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/openapi.json', (req, res) => res.sendFile(path.join(__dirname, 'openapi.json')));
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const account = username === 'admin' ? { password: ADMIN_PASSWORD, role: 'admin' }
    : username === 'alumno' ? { password: USER_PASSWORD, role: 'user' } : null;
  if (!account || typeof password !== 'string' || !same(password, account.password)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  const token = jwt.sign({ role: account.role }, JWT_SECRET, {
    algorithm: 'HS256', subject: username, issuer: 'laboratorio-local',
    audience: 'api-local', expiresIn: '15m'
  });
  return res.json({ token });
});
app.get('/api/admin', authenticate, (req, res) => {
  if (req.auth.role !== 'admin') return res.status(403).json({ error: 'Permiso insuficiente' });
  return res.json({ message: 'Acceso administrativo autorizado' });
});
app.use((err, req, res, next) => res.status(400).json({ error: 'Solicitud inválida' }));
if (require.main === module) app.listen(3000, '0.0.0.0');
module.exports = app;
