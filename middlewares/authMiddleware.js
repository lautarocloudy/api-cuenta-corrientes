// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) return res.status(401).json({ error: 'Falta el token.' });

  const token = authHeader.split(' ')[1]; // Bearer <token>

  if (!token) return res.status(401).json({ error: 'Token inválido.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded; // ahora req.usuario tiene { id, rol }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token no válido o expirado.' });
  }
}

module.exports = verificarToken;
