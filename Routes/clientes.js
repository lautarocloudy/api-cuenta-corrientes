// routes/clientes.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../middlewares/authMiddleware');

// Obtener todos los clientes
router.get('/', verificarToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clientes ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// Obtener cliente por ID
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clientes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
});

// Crear nuevo cliente
// Crear nuevo cliente (con validación de CUIT único)
router.post('/', verificarToken, async (req, res) => {
  const { nombre, domicilio, cuit, email, telefono } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });

  try {
    if (cuit) {
      const cuitExistente = await pool.query('SELECT * FROM clientes WHERE cuit = $1', [cuit]);
      if (cuitExistente.rows.length > 0) {
        return res.status(400).json({ error: 'El CUIT ya está registrado.' });
      }
    }

    await pool.query(
      'INSERT INTO clientes (nombre, domicilio, cuit, email, telefono) VALUES ($1, $2, $3, $4, $5)',
      [nombre, domicilio, cuit, email, telefono]
    );

    res.json({ mensaje: 'Cliente creado correctamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear cliente.' });
  }
});


// Actualizar cliente (con validación de CUIT único)
router.put('/:id', verificarToken, async (req, res) => {
  const { nombre, domicilio, cuit, email, telefono } = req.body;
  const id = req.params.id;

  try {
    if (cuit) {
      const cuitExistente = await pool.query(
        'SELECT * FROM clientes WHERE cuit = $1 AND id != $2',
        [cuit, id]
      );
      if (cuitExistente.rows.length > 0) {
        return res.status(400).json({ error: 'El CUIT ya pertenece a otro cliente.' });
      }
    }

    const result = await pool.query(
      `UPDATE clientes 
       SET nombre=$1, domicilio=$2, cuit=$3, email=$4, telefono=$5 
       WHERE id=$6 RETURNING *`,
      [nombre, domicilio, cuit, email, telefono, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });

    res.json({ mensaje: 'Cliente actualizado.', cliente: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar cliente.' });
  }
});


// Eliminar cliente
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM clientes WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ mensaje: 'Cliente eliminado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
});

module.exports = router;
