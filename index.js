const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/auth', require('./Routes/auth'));
app.use('/api/usuarios', require('./Routes/usuarios'));
app.use('/api/clientes', require('./Routes/clientes'));
app.use('/api/proveedores', require('./Routes/proveedores'));
app.use('/api/facturas', require('./Routes/facturas'));
app.use('/api/recibos', require('./Routes/recibos'));
app.use('/api/balance', require('./Routes/balance'));

// Puerto
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Prueba de conexión MySQL
async function testConnection() {
  try {
    const [rows] = await db.execute('SELECT NOW() AS now');
    console.log('Conexión OK:', rows[0]);
  } catch (err) {
    console.error('Error de conexión:', err);
  }
}

testConnection();
