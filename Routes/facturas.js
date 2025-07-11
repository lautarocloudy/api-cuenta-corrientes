const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const verificarToken = require('../middlewares/authMiddleware');

// Crear factura con ítems
router.post('/', verificarToken, async (req, res) => {
  const { numero, fecha, tipo, tipo_f, cliente_id, proveedor_id, detalles } = req.body;
  const items = detalles || [];

  if (!numero || !fecha || !tipo || !tipo_f || !items.length) {
    return res.status(400).json({ error: 'Faltan datos obligatorios o no hay ítems.' });
  }

  const tiposValidos = ['venta', 'compra'];
  const tiposFValidos = ['factura', 'nota de crédito', 'nota de débito', "saldo inicial"];

  if (!tiposValidos.includes(tipo)) {
    return res.status(400).json({ error: 'El tipo debe ser "venta" o "compra".' });
  }

  if (!tiposFValidos.includes(tipo_f)) {
    return res.status(400).json({ error: 'tipo_f inválido.' });
  }

  if (tipo === 'venta' && !cliente_id) {
    return res.status(400).json({ error: 'cliente_id requerido para tipo "venta".' });
  }

  if (tipo === 'compra' && !proveedor_id) {
    return res.status(400).json({ error: 'proveedor_id requerido para tipo "compra".' });
  }

  const subtotal = items.reduce((acc, item) => acc + item.cantidad * item.precio, 0);
  const iva = subtotal * 0.21;
  const total = subtotal + iva;

  try {
    // Insertar factura
    const { data: facturaData, error: facturaError } = await supabase
      .from('facturas')
      .insert([
        {
          numero,
          fecha,
          tipo,
          tipo_f,
          cliente_id: cliente_id || null,
          proveedor_id: proveedor_id || null,
          subtotal,
          iva,
          total,
        }
      ])
      .select()
      .single();

    if (facturaError) throw facturaError;

    // Insertar ítems
    for (const item of items) {
      const { error: itemError } = await supabase
        .from('factura_items')
        .insert([
          {
            factura_id: facturaData.id,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precio_unitario: item.precio,
          }
        ]);
      if (itemError) throw itemError;
    }

    res.json({ mensaje: 'Factura creada correctamente', facturaId: facturaData.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la factura.' });
  }
});

router.get('/buscar', verificarToken, async (req, res) => {
  console.log('QUERY DETECTADA1', req.query)
  const { tipo, nombre, desde, hasta } = req.query;

  if (!tipo || (tipo !== 'venta' && tipo !== 'compra')) {
    return res.status(400).json({ error: 'El tipo debe ser "venta" o "compra".' });
  }

  try {
    const idField = tipo === 'venta' ? 'cliente_id' : 'proveedor_id';
    const tableName = tipo === 'venta' ? 'clientes' : 'proveedores';

    let idsFiltrados = null;

    if (nombre) {
      const { data: entidades, error: errorEntidades } = await supabase
        .from(tableName)
        .select('id')
        .ilike('nombre', `%${nombre}%`);

      if (errorEntidades) throw errorEntidades;

      idsFiltrados = entidades.map((e) => e.id);

      // Si no hay coincidencias → devolver array vacío sin ejecutar el query
      if (idsFiltrados.length === 0) {
        console.log('No hay coincidencias por nombre:', nombre);
        return res.json([]);
      }
    }

    let query = supabase
      .from('facturas')
      .select(`
        *,
        cliente:clientes(nombre),
        proveedor:proveedores(nombre)
      `)
      .eq('tipo', tipo);

    if (desde) query = query.gte('fecha', desde);
    if (hasta) query = query.lte('fecha', hasta);

    // Aplicar filtro solo si hay resultados
    if (idsFiltrados && idsFiltrados.length > 0) {
      query = query.in(idField, idsFiltrados);
    }

    const { data, error } = await query;

    if (error) throw error;

    const facturas = data.map(f => ({
      ...f,
      cliente_nombre: f.cliente?.nombre || null,
      proveedor_nombre: f.proveedor?.nombre || null,
      cliente: undefined,
      proveedor: undefined,
    }));

    res.json(facturas);
  } catch (err) {
    console.error('ERROR en /buscar:', err);
    res.status(500).json({ error: 'Error al buscar facturas.' });
  }
});


// Obtener facturas por tipo
router.get('/', verificarToken, async (req, res) => {
  const { tipo } = req.query;

  if (!tipo || (tipo !== 'venta' && tipo !== 'compra')) {
    return res.status(400).json({ error: 'Debés indicar el tipo: "venta" o "compra".' });
  }

  try {
    const { data, error } = await supabase
      .from('facturas')
      .select(`
        *,
        cliente:clientes(nombre),
        proveedor:proveedores(nombre)
      `)
      .eq('tipo', tipo)
      .order('fecha', { ascending: false });

    if (error) throw error;

    // Mapear nombres para que queden a nivel superior (opcional)
    const facturas = data.map(f => ({
      ...f,
      cliente_nombre: f.cliente?.nombre || null,
      proveedor_nombre: f.proveedor?.nombre || null,
      cliente: undefined,
      proveedor: undefined,
    }));

    res.json(facturas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener facturas.' });
  }
});

// Obtener factura por ID con ítems
router.get('/:id', verificarToken, async (req, res) => {
  const facturaId = req.params.id;
console.log('QUERY DETECTADA', req.query)
  try {
    const { data: facturaData, error: facturaError } = await supabase
      .from('facturas')
      .select(`
        *,
        cliente:clientes(nombre),
        proveedor:proveedores(nombre)
      `)
      .eq('id', facturaId)
      .single();

    if (facturaError) {
      if (facturaError.code === 'PGRST116') return res.status(404).json({ error: 'Factura no encontrada.' });
      throw facturaError;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('factura_items')
      .select('id, descripcion, cantidad, precio_unitario')
      .eq('factura_id', facturaId);

    if (itemsError) throw itemsError;

    const factura = {
      ...facturaData,
      cliente_nombre: facturaData.cliente?.nombre || null,
      proveedor_nombre: facturaData.proveedor?.nombre || null,
      detalles: itemsData,
    };

    delete factura.cliente;
    delete factura.proveedor;

    res.json(factura);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener la factura.' });
  }
});


// Actualizar factura con ítems
router.put('/:id', verificarToken, async (req, res) => {
  const facturaId = req.params.id;
  const { numero, fecha, tipo, tipo_f, cliente_id, proveedor_id, detalles } = req.body;
  const items = detalles || [];

  if (!numero || !fecha || !tipo || !tipo_f || !items.length) {
    return res.status(400).json({ error: 'Faltan datos obligatorios o ítems vacíos.' });
  }

  const tiposValidos = ['venta', 'compra'];
  const tiposFValidos = ['factura', 'nota de crédito', 'nota de débito'];

  if (!tiposValidos.includes(tipo)) {
    return res.status(400).json({ error: 'Tipo inválido.' });
  }

  if (!tiposFValidos.includes(tipo_f)) {
    return res.status(400).json({ error: 'tipo_f inválido.' });
  }

  if (tipo === 'venta' && !cliente_id) {
    return res.status(400).json({ error: 'cliente_id requerido para tipo "venta".' });
  }

  if (tipo === 'compra' && !proveedor_id) {
    return res.status(400).json({ error: 'proveedor_id requerido para tipo "compra".' });
  }

  const subtotal = items.reduce((acc, item) => acc + item.cantidad * item.precio, 0);
  const iva = subtotal * 0.21;
  const total = subtotal + iva;

  try {
    // Actualizar factura
    const { data: updateData, error: updateError } = await supabase
      .from('facturas')
      .update({
        numero,
        fecha,
        tipo,
        tipo_f,
        cliente_id: cliente_id || null,
        proveedor_id: proveedor_id || null,
        subtotal,
        iva,
        total,
      })
      .eq('id', facturaId)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') return res.status(404).json({ error: 'Factura no encontrada.' });
      throw updateError;
    }

    // Borrar ítems antiguos
    const { error: deleteError } = await supabase
      .from('factura_items')
      .delete()
      .eq('factura_id', facturaId);

    if (deleteError) throw deleteError;

    // Insertar ítems nuevos
    for (const item of items) {
      const { error: itemError } = await supabase
        .from('factura_items')
        .insert([
          {
            factura_id: facturaId,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precio_unitario: item.precio,
          }
        ]);
      if (itemError) throw itemError;
    }

    res.json({ mensaje: 'Factura actualizada correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la factura.' });
  }
});


// Eliminar factura
router.delete('/:id', verificarToken, async (req, res) => {
  const facturaId = req.params.id;
  try {
    const { data, error } = await supabase
      .from('facturas')
      .delete()
      .eq('id', facturaId)
      .select();

    if (error) throw error;
    if (!data.length) return res.status(404).json({ error: 'Factura no encontrada.' });

    res.json({ mensaje: 'Factura eliminada correctamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la factura.' });
  }
});






module.exports = router;
