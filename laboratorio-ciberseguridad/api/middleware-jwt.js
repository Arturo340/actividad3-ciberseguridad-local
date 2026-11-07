
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
app.get('/api/admin', authenticate, (req, res) => {
  if (req.auth.role !== 'admin') return res.status(403).json({ error: 'Permiso insuficiente' });
  return res.json({ message: 'Acceso administrativo autorizado' });
});
