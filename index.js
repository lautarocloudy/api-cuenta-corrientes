// index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config(); // carga variables de .env
const db = require('./db');
const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // para leer JSON en los requests

// Rutas
app.use('/api/auth', require('./Routes/auth')); // para login
app.use('/api/usuarios', require('./Routes/usuarios'));
app.use('/api/clientes', require('./Routes/clientes'));
app.use('/api/proveedores', require('./Routes/proveedores'));
app.use('/api/facturas', require('./Routes/facturas'));
app.use('/api/recibos', require('./Routes/recibos'));
app.use('/api/balance', require('./Routes/balance'));



// Puerto desde .env o por defecto 4000
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});


db.query('SELECT NOW()')
  .then(res => console.log('Conexión OK:', res.rows[0]))
  .catch(err => console.error('Error de conexión:', err));
