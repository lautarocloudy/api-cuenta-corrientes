// routes/balance.js
const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const verificarToken = require('../middlewares/authMiddleware');

// Balance de clientes
router.get('/clientes', verificarToken, async (req, res) => {
  try {
    // Obtener clientes
    const { data: clientes, error: clientesError } = await supabase
      .from('clientes')
      .select('id, nombre');
    if (clientesError) throw clientesError;

    // Obtener facturas tipo venta con total y tipo_f
    const { data: facturas, error: facturasError } = await supabase
      .from('facturas')
      .select('cliente_id, tipo_f, total, tipo')
      .eq('tipo', 'venta');
    if (facturasError) throw facturasError;

    // Obtener cobros por cliente
    const { data: cobros, error: cobrosError } = await supabase
      .from('recibos')
      .select('cliente_id, total, tipo')
      .eq('tipo', 'cobro');
    if (cobrosError) throw cobrosError;

    // Mapear total facturado por cliente
    const facturadoMap = {};
    facturas.forEach(f => {
      const clienteId = f.cliente_id;
      if (!facturadoMap[clienteId]) facturadoMap[clienteId] = 0;
      if (f.tipo_f === 'factura' || f.tipo_f === 'nota de débito') {
        facturadoMap[clienteId] += parseFloat(f.total);
      } else if (f.tipo_f === 'nota de crédito') {
        facturadoMap[clienteId] -= parseFloat(f.total);
      }
    });

    // Mapear total cobrado por cliente
    const cobradoMap = {};
    cobros.forEach(c => {
      const clienteId = c.cliente_id;
      if (!cobradoMap[clienteId]) cobradoMap[clienteId] = 0;
      cobradoMap[clienteId] += parseFloat(c.total);
    });

    // Crear resultado final
    const resultado = clientes.map(c => {
      const total_facturado = facturadoMap[c.id] || 0;
      const total_cobrado = cobradoMap[c.id] || 0;
      const saldo = parseFloat((total_facturado - total_cobrado).toFixed(2));

      return {
        id: c.id,
        nombre: c.nombre,
        total_facturado,
        total_cobrado,
        saldo
      };
    });

    res.json(resultado);
  } catch (err) {
    console.error('Error balance clientes:', err.message);
    res.status(500).json({ error: 'Error al calcular balance de clientes' });
  }
});

// Balance de proveedores
router.get('/proveedores', verificarToken, async (req, res) => {
  try {
    // Obtener proveedores
    const { data: proveedores, error: proveedoresError } = await supabase
      .from('proveedores')
      .select('id, nombre');
    if (proveedoresError) throw proveedoresError;

    // Obtener facturas tipo compra
    const { data: facturas, error: facturasError } = await supabase
      .from('facturas')
      .select('proveedor_id, tipo_f, total, tipo')
      .eq('tipo', 'compra');
    if (facturasError) throw facturasError;

    // Obtener pagos por proveedor
    const { data: pagos, error: pagosError } = await supabase
      .from('recibos')
      .select('proveedor_id, total, tipo')
      .eq('tipo', 'pago');
    if (pagosError) throw pagosError;

    // Mapear total facturado por proveedor
    const facturadoMap = {};
    facturas.forEach(f => {
      const proveedorId = f.proveedor_id;
      if (!facturadoMap[proveedorId]) facturadoMap[proveedorId] = 0;
      if (f.tipo_f === 'factura' || f.tipo_f === 'nota de débito') {
        facturadoMap[proveedorId] += parseFloat(f.total);
      } else if (f.tipo_f === 'nota de crédito') {
        facturadoMap[proveedorId] -= parseFloat(f.total);
      }
    });

    // Mapear total pagado por proveedor
    const pagadoMap = {};
    pagos.forEach(p => {
      const proveedorId = p.proveedor_id;
      if (!pagadoMap[proveedorId]) pagadoMap[proveedorId] = 0;
      pagadoMap[proveedorId] += parseFloat(p.total);
    });

    // Crear resultado final
    const resultado = proveedores.map(p => {
      const total_facturado = facturadoMap[p.id] || 0;
      const total_pagado = pagadoMap[p.id] || 0;
      const saldo = parseFloat((total_facturado - total_pagado).toFixed(2));

      return {
        id: p.id,
        nombre: p.nombre,
        total_facturado,
        total_pagado,
        saldo
      };
    });

    res.json(resultado);
  } catch (err) {
    console.error('Error balance proveedores:', err.message);
    res.status(500).json({ error: 'Error al calcular balance de proveedores' });
  }
});

module.exports = router;
