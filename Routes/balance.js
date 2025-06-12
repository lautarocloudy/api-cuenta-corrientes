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

router.get('/clientes/buscar/:nombre', verificarToken, async (req, res) => {
  const nombre = req.params.nombre;

  try {
    // Buscar cliente por nombre (parcial o exacto)
    const { data: clientes, error: clienteError } = await supabase
      .from('clientes')
      .select('id, nombre')
      .ilike('nombre', `%${nombre}%`);
    if (clienteError) throw clienteError;

    if (!clientes.length) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Si hay más de uno, podés devolver todos o elegir el primero
    // Para ahora, vamos a procesar todos los que coincidan
    const resultados = [];

    for (const cliente of clientes) {
      const clienteId = cliente.id;

      const { data: facturas } = await supabase
        .from('facturas')
        .select('tipo_f, total')
        .eq('cliente_id', clienteId)
        .eq('tipo', 'venta');

      const { data: cobros } = await supabase
        .from('recibos')
        .select('total')
        .eq('cliente_id', clienteId)
        .eq('tipo', 'cobro');

      let total_facturado = 0;
      facturas.forEach(f => {
        if (f.tipo_f === 'factura' || f.tipo_f === 'nota de débito') {
          total_facturado += parseFloat(f.total);
        } else if (f.tipo_f === 'nota de crédito') {
          total_facturado -= parseFloat(f.total);
        }
      });

      let total_cobrado = 0;
      cobros.forEach(c => total_cobrado += parseFloat(c.total));

      const saldo = parseFloat((total_facturado - total_cobrado).toFixed(2));

      resultados.push({
        id: cliente.id,
        nombre: cliente.nombre,
        total_facturado,
        total_cobrado,
        saldo
      });
    }

    res.json(resultados);
  } catch (err) {
    console.error('Error buscando balance cliente:', err.message);
    res.status(500).json({ error: 'Error al buscar balance del cliente' });
  }
});
router.get('/proveedores/buscar/:nombre', verificarToken, async (req, res) => {
  const nombre = req.params.nombre;

  try {
    const { data: proveedores, error: proveedorError } = await supabase
      .from('proveedores')
      .select('id, nombre')
      .ilike('nombre', `%${nombre}%`);
    if (proveedorError) throw proveedorError;

    if (!proveedores.length) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    const resultados = [];

    for (const proveedor of proveedores) {
      const proveedorId = proveedor.id;

      const { data: facturas } = await supabase
        .from('facturas')
        .select('tipo_f, total')
        .eq('proveedor_id', proveedorId)
        .eq('tipo', 'compra');

      const { data: pagos } = await supabase
        .from('recibos')
        .select('total')
        .eq('proveedor_id', proveedorId)
        .eq('tipo', 'pago');

      let total_facturado = 0;
      facturas.forEach(f => {
        if (f.tipo_f === 'factura' || f.tipo_f === 'nota de débito') {
          total_facturado += parseFloat(f.total);
        } else if (f.tipo_f === 'nota de crédito') {
          total_facturado -= parseFloat(f.total);
        }
      });

      let total_pagado = 0;
      pagos.forEach(p => total_pagado += parseFloat(p.total));

      const saldo = parseFloat((total_facturado - total_pagado).toFixed(2));

      resultados.push({
        id: proveedor.id,
        nombre: proveedor.nombre,
        total_facturado,
        total_pagado,
        saldo
      });
    }

    res.json(resultados);
  } catch (err) {
    console.error('Error buscando balance proveedor:', err.message);
    res.status(500).json({ error: 'Error al buscar balance del proveedor' });
  }
});


module.exports = router;
