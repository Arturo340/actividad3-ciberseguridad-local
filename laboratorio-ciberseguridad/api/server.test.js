const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'secreto-exclusivo-de-pruebas-32-bytes-minimo';
process.env.ADMIN_PASSWORD = 'admin-de-prueba';
process.env.USER_PASSWORD = 'alumno-de-prueba';
const server = require('./server').listen(0, '127.0.0.1');
after(() => server.close());
async function request(token) {
  return fetch(`http://127.0.0.1:${server.address().port}/api/admin`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
}
function sign(role, extra = {}, secret = process.env.JWT_SECRET) {
  return jwt.sign({ role }, secret, { algorithm:'HS256', issuer:'laboratorio-local',
    audience:'api-local', expiresIn:'15m', ...extra });
}
test('sin token: 401', async () => assert.equal((await request()).status, 401));
test('token alterado: 401', async () => assert.equal((await request('alterado')).status, 401));
test('firma incorrecta: 401', async () => assert.equal((await request(sign('admin', {}, 'otra-clave'))).status, 401));
test('vencido: 401', async () => assert.equal((await request(sign('admin', {expiresIn:-1}))).status, 401));
test('audiencia incorrecta: 401', async () => assert.equal((await request(sign('admin', {audience:'otra'}))).status, 401));
test('usuario sin permisos: 403', async () => assert.equal((await request(sign('user'))).status, 403));
test('administrador: 200', async () => assert.equal((await request(sign('admin'))).status, 200));
test('login asigna rol desde el servidor', async () => {
 const response = await fetch(`http://127.0.0.1:${server.address().port}/api/login`, {
 method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({username:'alumno',password:process.env.USER_PASSWORD,role:'admin'}) });
 assert.equal(response.status,200);
 assert.equal((await request((await response.json()).token)).status,403);
});
