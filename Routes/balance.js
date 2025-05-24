// routes/balance.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../middlewares/authMiddleware');

// Balance de clientes
router.get('/clientes', verificarToken, async (req, res) => {
  try {
    const facturas = await pool.query(`
      SELECT c.id AS cliente_id, c.nombre, 
             COALESCE(SUM(f.total), 0) AS total_facturado
      FROM clientes c
      LEFT JOIN facturas f ON f.cliente_id = c.id AND f.tipo = 'venta'
      GROUP BY c.id
    `);

    const cobros = await pool.query(`
      SELECT cliente_id, COALESCE(SUM(total), 0) AS total_cobrado
      FROM recibos
      WHERE tipo = 'cobro'
      GROUP BY cliente_id
    `);

    const cobrosMap = {};
    for (const row of cobros.rows) {
      cobrosMap[row.cliente_id] = parseFloat(row.total_cobrado);
    }

    const resultado = facturas.rows.map(cliente => {
      const total_facturado = parseFloat(cliente.total_facturado);
      const total_cobrado = cobrosMap[cliente.cliente_id] || 0;
      const saldo = total_facturado - total_cobrado;

      return {
        id: cliente.cliente_id,
        nombre: cliente.nombre,
        total_facturado,
        total_cobrado,
        saldo
      };
    });

    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular balance de clientes' });
  }
});
// Balance de proveedores
router.get('/proveedores', verificarToken, async (req, res) => {
  try {
    const facturas = await pool.query(`
      SELECT p.id AS proveedor_id, p.nombre, 
             COALESCE(SUM(f.total), 0) AS total_facturado
      FROM proveedores p
      LEFT JOIN facturas f ON f.proveedor_id = p.id AND f.tipo = 'compra'
      GROUP BY p.id
    `);

    const pagos = await pool.query(`
      SELECT proveedor_id, COALESCE(SUM(total), 0) AS total_pagado
      FROM recibos
      WHERE tipo = 'pago'
      GROUP BY proveedor_id
    `);

    const pagosMap = {};
    for (const row of pagos.rows) {
      pagosMap[row.proveedor_id] = parseFloat(row.total_pagado);
    }

    const resultado = facturas.rows.map(proveedor => {
      const total_facturado = parseFloat(proveedor.total_facturado);
      const total_pagado = pagosMap[proveedor.proveedor_id] || 0;
      const saldo = total_facturado - total_pagado;

      return {
        id: proveedor.proveedor_id,
        nombre: proveedor.nombre,
        total_facturado,
        total_pagado,
        saldo
      };
    });

    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular balance de proveedores' });
  }
});

module.exports = router;
