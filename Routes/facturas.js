// routes/facturas.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../middlewares/authMiddleware');
// Crear factura con ítems
router.post('/', verificarToken, async (req, res) => {
    const { numero, fecha, tipo, cliente_id, proveedor_id, items } = req.body;

    if (!numero || !fecha || !tipo || !items || items.length === 0) {
        return res.status(400).json({ error: 'Faltan datos obligatorios o no hay ítems.' });
    }

    if (tipo !== 'venta' && tipo !== 'compra') {
        return res.status(400).json({ error: 'El tipo debe ser "venta" o "compra".' });
    }

    if (tipo === 'venta' && !cliente_id) {
        return res.status(400).json({ error: 'cliente_id requerido para tipo "venta".' });
    }

    if (tipo === 'compra' && !proveedor_id) {
        return res.status(400).json({ error: 'proveedor_id requerido para tipo "compra".' });
    }

    const subtotal = items.reduce((acc, item) => acc + item.cantidad * item.precio_unitario, 0);
    const iva = subtotal * 0.21;
    const total = subtotal + iva;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const facturaResult = await client.query(
            `INSERT INTO facturas (numero, fecha, tipo, cliente_id, proveedor_id, subtotal, iva, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [numero, fecha, tipo, cliente_id || null, proveedor_id || null, subtotal, iva, total]
        );

        const facturaId = facturaResult.rows[0].id;

        for (const item of items) {
            await client.query(
                `INSERT INTO factura_items (factura_id, descripcion, cantidad, precio_unitario)
         VALUES ($1, $2, $3, $4)`,
                [facturaId, item.descripcion, item.cantidad, item.precio_unitario]
            );
        }

        await client.query('COMMIT');

        res.json({ mensaje: 'Factura creada correctamente', facturaId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Error al crear la factura.' });
    } finally {
        client.release();
    }
});

// GET /api/facturas?tipo=venta o tipo=compra
router.get('/', verificarToken, async (req, res) => {
    const { tipo } = req.query;

    if (!tipo || (tipo !== 'venta' && tipo !== 'compra')) {
        return res.status(400).json({ error: 'Debés indicar el tipo: "venta" o "compra".' });
    }

    try {
        const result = await pool.query(
            `
  SELECT f.*, 
         c.nombre AS cliente_nombre, 
         p.nombre AS proveedor_nombre
  FROM facturas f
  LEFT JOIN clientes c ON f.cliente_id = c.id
  LEFT JOIN proveedores p ON f.proveedor_id = p.id
  WHERE f.tipo = $1
  ORDER BY f.fecha DESC
  `,
            [tipo]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener facturas.' });
    }
});

// GET /api/facturas/:id
router.get('/:id', verificarToken, async (req, res) => {
    const facturaId = req.params.id;

    try {
        const facturaResult = await pool.query(
            `
  SELECT f.*, 
         c.nombre AS cliente_nombre, 
         p.nombre AS proveedor_nombre
  FROM facturas f
  LEFT JOIN clientes c ON f.cliente_id = c.id
  LEFT JOIN proveedores p ON f.proveedor_id = p.id
  WHERE f.id = $1
  `,
            [facturaId]
        );

        if (facturaResult.rows.length === 0) {
            return res.status(404).json({ error: 'Factura no encontrada.' });
        }

        const factura = facturaResult.rows[0];

        const itemsResult = await pool.query(
            'SELECT id, descripcion, cantidad, precio_unitario FROM factura_items WHERE factura_id = $1',
            [facturaId]
        );

        factura.items = itemsResult.rows;

        res.json(factura);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener la factura.' });
    }
});

router.put('/:id', verificarToken, async (req, res) => {
  const facturaId = req.params.id;
  const { numero, fecha, tipo, cliente_id, proveedor_id, items } = req.body;

  if (!numero || !fecha || !tipo || !items || items.length === 0) {
    return res.status(400).json({ error: 'Faltan datos obligatorios o ítems vacíos.' });
  }

  if (tipo !== 'venta' && tipo !== 'compra') {
    return res.status(400).json({ error: 'Tipo inválido.' });
  }

  if (tipo === 'venta' && !cliente_id) {
    return res.status(400).json({ error: 'cliente_id requerido para tipo "venta".' });
  }

  if (tipo === 'compra' && !proveedor_id) {
    return res.status(400).json({ error: 'proveedor_id requerido para tipo "compra".' });
  }

  const subtotal = items.reduce((acc, item) => acc + item.cantidad * item.precio_unitario, 0);
  const iva = subtotal * 0.21;
  const total = subtotal + iva;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE facturas SET numero=$1, fecha=$2, tipo=$3, cliente_id=$4, proveedor_id=$5, subtotal=$6, iva=$7, total=$8 WHERE id=$9`,
      [numero, fecha, tipo, cliente_id || null, proveedor_id || null, subtotal, iva, total, facturaId]
    );

    await client.query('DELETE FROM factura_items WHERE factura_id = $1', [facturaId]);

    for (const item of items) {
      await client.query(
        `INSERT INTO factura_items (factura_id, descripcion, cantidad, precio_unitario)
         VALUES ($1, $2, $3, $4)`,
        [facturaId, item.descripcion, item.cantidad, item.precio_unitario]
      );
    }

    await client.query('COMMIT');
    res.json({ mensaje: 'Factura actualizada correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la factura.' });
  } finally {
    client.release();
  }
});

router.delete('/:id', verificarToken, async (req, res) => {
  const facturaId = req.params.id;
  try {
    const result = await pool.query('DELETE FROM facturas WHERE id = $1 RETURNING *', [facturaId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Factura no encontrada.' });
    }
    res.json({ mensaje: 'Factura eliminada correctamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la factura.' });
  }
});


module.exports = router;
