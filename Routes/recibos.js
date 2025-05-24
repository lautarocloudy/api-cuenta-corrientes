// routes/recibos.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../middlewares/authMiddleware');
// Crear recibo con cheques
router.post('/', verificarToken, async (req, res) => {
  const {
    numero,
    fecha,
    tipo,
    cliente_id,
    proveedor_id,
    factura_id,
    efectivo,
    transferencia,
    otros,
    observaciones,
    cheques
  } = req.body;

  if (!fecha || !tipo || (tipo !== 'cobro' && tipo !== 'pago')) {
    return res.status(400).json({ error: 'Tipo o fecha inválidos.' });
  }

  if (tipo === 'cobro' && !cliente_id) {
    return res.status(400).json({ error: 'cliente_id requerido para "cobro".' });
  }

  if (tipo === 'pago' && !proveedor_id) {
    return res.status(400).json({ error: 'proveedor_id requerido para "pago".' });
  }

  const totalCheques = cheques?.reduce((acc, c) => acc + c.monto, 0) || 0;
  const total = (efectivo || 0) + (transferencia || 0) + (otros || 0) + totalCheques;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const reciboResult = await client.query(
      `INSERT INTO recibos (numero, fecha, tipo, cliente_id, proveedor_id, factura_id, efectivo, transferencia, otros, observaciones, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        numero,
        fecha,
        tipo,
        cliente_id || null,
        proveedor_id || null,
        factura_id || null,
        efectivo || 0,
        transferencia || 0,
        otros || 0,
        observaciones || '',
        total
      ]
    );

    const reciboId = reciboResult.rows[0].id;

    if (cheques && cheques.length > 0) {
      for (const cheque of cheques) {
        await client.query(
          `INSERT INTO recibo_cheques (recibo_id, tipo, fecha_cobro, banco, numero, monto)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [reciboId, cheque.tipo, cheque.fecha_cobro, cheque.banco, cheque.numero, cheque.monto]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ mensaje: 'Recibo creado correctamente', reciboId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al crear el recibo.' });
  } finally {
    client.release();
  }
});

// GET /api/recibos?tipo=cobro o tipo=pago
router.get('/', verificarToken, async (req, res) => {
  const { tipo } = req.query;

  if (!tipo || (tipo !== 'cobro' && tipo !== 'pago')) {
    return res.status(400).json({ error: 'Debés indicar el tipo: "cobro" o "pago".' });
  }

  try {
    const result = await pool.query(
      `
      SELECT r.*, 
             c.nombre AS cliente_nombre, 
             p.nombre AS proveedor_nombre
      FROM recibos r
      LEFT JOIN clientes c ON r.cliente_id = c.id
      LEFT JOIN proveedores p ON r.proveedor_id = p.id
      WHERE r.tipo = $1
      ORDER BY r.fecha DESC
      `,
      [tipo]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener recibos.' });
  }
});
// GET /api/recibos/:id
router.get('/:id', verificarToken, async (req, res) => {
  const reciboId = req.params.id;

  try {
    const reciboResult = await pool.query(
      `
      SELECT r.*, 
             c.nombre AS cliente_nombre, 
             p.nombre AS proveedor_nombre
      FROM recibos r
      LEFT JOIN clientes c ON r.cliente_id = c.id
      LEFT JOIN proveedores p ON r.proveedor_id = p.id
      WHERE r.id = $1
      `,
      [reciboId]
    );

    if (reciboResult.rows.length === 0) {
      return res.status(404).json({ error: 'Recibo no encontrado.' });
    }

    const recibo = reciboResult.rows[0];

    const chequesResult = await pool.query(
      'SELECT * FROM recibo_cheques WHERE recibo_id = $1',
      [reciboId]
    );

    recibo.cheques = chequesResult.rows;

    res.json(recibo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el recibo.' });
  }
});
// editar
router.put('/:id', verificarToken, async (req, res) => {
  const reciboId = req.params.id;
  const {
    numero,
    fecha,
    tipo,
    cliente_id,
    proveedor_id,
    factura_id,
    efectivo,
    transferencia,
    otros,
    observaciones,
    cheques
  } = req.body;

  if (!fecha || !tipo || (tipo !== 'cobro' && tipo !== 'pago')) {
    return res.status(400).json({ error: 'Tipo o fecha inválidos.' });
  }

  if (tipo === 'cobro' && !cliente_id) {
    return res.status(400).json({ error: 'cliente_id requerido para "cobro".' });
  }

  if (tipo === 'pago' && !proveedor_id) {
    return res.status(400).json({ error: 'proveedor_id requerido para "pago".' });
  }

  const totalCheques = cheques?.reduce((acc, c) => acc + c.monto, 0) || 0;
  const total = (efectivo || 0) + (transferencia || 0) + (otros || 0) + totalCheques;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE recibos SET 
         numero = $1,
         fecha = $2,
         tipo = $3,
         cliente_id = $4,
         proveedor_id = $5,
         factura_id = $6,
         efectivo = $7,
         transferencia = $8,
         otros = $9,
         observaciones = $10,
         total = $11
       WHERE id = $12`,
      [
        numero,
        fecha,
        tipo,
        cliente_id || null,
        proveedor_id || null,
        factura_id || null,
        efectivo || 0,
        transferencia || 0,
        otros || 0,
        observaciones || '',
        total,
        reciboId
      ]
    );

    await client.query('DELETE FROM recibo_cheques WHERE recibo_id = $1', [reciboId]);

    if (cheques && cheques.length > 0) {
      for (const cheque of cheques) {
        await client.query(
          `INSERT INTO recibo_cheques (recibo_id, tipo, fecha_cobro, banco, numero, monto)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [reciboId, cheque.tipo, cheque.fecha_cobro, cheque.banco, cheque.numero, cheque.monto]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ mensaje: 'Recibo actualizado correctamente.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el recibo.' });
  } finally {
    client.release();
  }
});
// eliminar
router.delete('/:id', verificarToken, async (req, res) => {
  const reciboId = req.params.id;

  try {
    const result = await pool.query('DELETE FROM recibos WHERE id = $1 RETURNING *', [reciboId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recibo no encontrado.' });
    }
    res.json({ mensaje: 'Recibo eliminado correctamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el recibo.' });
  }
});

module.exports = router;
