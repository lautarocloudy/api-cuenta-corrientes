const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const verificarToken = require('../middlewares/authMiddleware');

// =======================
// Balance de todos los clientes
// =======================
router.get('/clientes', verificarToken, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('balance_clientes');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error balance clientes:', err.message);
    res.status(500).json({ error: 'Error al calcular balance de clientes' });
  }
});

// =======================
// Buscar balance por nombre (ruta que llama el front)
// =======================
router.get('/clientes/buscar/:nombre', verificarToken, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('balance_clientes', {
      p_nombre: req.params.nombre,
    });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error buscando balance cliente:', err.message);
    res.status(500).json({ error: 'Error al buscar balance de cliente' });
  }
});

// =======================
// Balance de un cliente hasta una fecha (YYYY-MM-DD)
// =======================
router.get('/balance-clientes', verificarToken, async (req, res) => {
  try {
    const { nombre, hasta } = req.query;

    // Validación: ambos son obligatorios
    if (!nombre || !hasta) {
      return res.status(400).json({
        error: "Debe enviar 'nombre' y 'hasta' en la consulta",
      });
    }

    const { data, error } = await supabase.rpc('balance_clientes', {
      p_hasta: hasta,
      p_nombre: nombre,
    });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error balance clientes:', err.message);
    res.status(500).json({ error: 'Error al calcular balance de clientes' });
  }
});

// =======================
// Balance de proveedores
// =======================
router.get('/proveedores', verificarToken, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('balance_proveedores');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error balance proveedores:', err.message);
    res.status(500).json({ error: 'Error al calcular balance de proveedores' });
  }
});

// =======================
// Buscar facturas por cliente/proveedor y rango de fechas
// =======================
router.get('/buscar', verificarToken, async (req, res) => {
  const { tipo, nombre, desde, hasta } = req.query;

  // Validaciones básicas
  if (!tipo || (tipo !== 'venta' && tipo !== 'compra')) {
    return res.status(400).json({ error: 'Tipo inválido. Debe ser "venta" o "compra".' });
  }

  if (!nombre || nombre.trim() === '') {
    return res.status(400).json({ error: 'Debés enviar el nombre del cliente o proveedor.' });
  }

  if (!desde || !hasta) {
    return res.status(400).json({ error: 'Debés enviar el rango de fechas: desde y hasta.' });
  }

  try {
    let idBuscado = null;

    if (tipo === 'venta') {
      // Buscar cliente por nombre (primer resultado)
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('id')
        .ilike('nombre', `%${nombre}%`)
        .limit(1)
        .maybeSingle();

      if (clienteError) throw clienteError;
      if (!clienteData) return res.status(404).json({ error: 'Cliente no encontrado.' });

      idBuscado = clienteData.id;
    } else {
      // Buscar proveedor por nombre (primer resultado)
      const { data: proveedorData, error: proveedorError } = await supabase
        .from('proveedores')
        .select('id')
        .ilike('nombre', `%${nombre}%`)
        .limit(1)
        .maybeSingle();

      if (proveedorError) throw proveedorError;
      if (!proveedorData) return res.status(404).json({ error: 'Proveedor no encontrado.' });

      idBuscado = proveedorData.id;
    }

    // Validar idBuscado numérico
    if (!idBuscado || isNaN(Number(idBuscado))) {
      return res.status(400).json({ error: 'ID de cliente o proveedor inválido.' });
    }

    // Buscar facturas filtradas por id y fecha
    const { data, error } = await supabase
      .from('facturas')
      .select(`
        *,
        cliente:clientes(nombre),
        proveedor:proveedores(nombre)
      `)
      .eq('tipo', tipo)
      .eq(tipo === 'venta' ? 'cliente_id' : 'proveedor_id', idBuscado)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: false });

    if (error) throw error;

    // Mapear nombres a nivel superior para frontend
    const facturas = data.map((f) => ({
      ...f,
      cliente_nombre: f.cliente?.nombre || null,
      proveedor_nombre: f.proveedor?.nombre || null,
      cliente: undefined,
      proveedor: undefined,
    }));

    res.json(facturas);
  } catch (err) {
    console.error('Error en /facturas/buscar:', err);
    res.status(500).json({ error: err.message || 'Error al buscar facturas.' });
  }
});

module.exports = router;

