const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const verificarToken = require('../middlewares/authMiddleware');
router.get('/', verificarToken, async (req, res) => {
  const { tipo } = req.query;

  if (!tipo || (tipo !== 'cobro' && tipo !== 'pago')) {
    return res.status(400).json({ error: 'Debés indicar el tipo: "cobro" o "pago".' });
  }

  try {
    const { data, error } = await supabase
      .from('recibos') // o 'recibos' si usás .select con relaciones
      .select('*')
      .eq('tipo', tipo)
      .order('fecha', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener recibos.' });
  }
});
// Crear recibo con cheques
router.get('/buscar', verificarToken, async (req, res) => {
  const { tipo, nombre, desde, hasta } = req.query;

  if (!tipo || (tipo !== 'cobro' && tipo !== 'pago')) {
    return res.status(400).json({ error: 'El tipo debe ser "cobro" o "pago".' });
  }

  try {
    const idField = tipo === 'cobro' ? 'cliente_id' : 'proveedor_id';
    const tableName = tipo === 'cobro' ? 'clientes' : 'proveedores';

    let idsFiltrados = null;

    if (nombre) {
      const { data: entidades, error: errorEntidades } = await supabase
        .from(tableName)
        .select('id')
        .ilike('nombre', `%${nombre}%`);

      if (errorEntidades) throw errorEntidades;

      idsFiltrados = entidades.map((e) => e.id);

      if (idsFiltrados.length === 0) {
        return res.json([]);
      }
    }

    let query = supabase
      .from('recibos')
      .select(`
        *,
        cliente:clientes(nombre),
        proveedor:proveedores(nombre)
      `)
      .eq('tipo', tipo);

    if (desde) query = query.gte('fecha', desde);
    if (hasta) query = query.lte('fecha', hasta);
    if (idsFiltrados && idsFiltrados.length > 0) {
      query = query.in(idField, idsFiltrados);
    }

    const { data, error } = await query;

    if (error) throw error;

    const recibos = data.map((r) => ({
      ...r,
      cliente_nombre: r.cliente?.nombre || null,
      proveedor_nombre: r.proveedor?.nombre || null,
      cliente: undefined,
      proveedor: undefined,
    }));

    res.json(recibos);
  } catch (err) {
    console.error('ERROR en /recibos/buscar:', err);
    res.status(500).json({ error: 'Error al buscar recibos.' });
  }
});




// Obtener recibo por ID
router.get('/:id', verificarToken, async (req, res) => {
  const reciboId = req.params.id;

  try {
    const { data: reciboData, error: errorRecibo } = await supabase
      .from('recibos')
      .select(`
        *,
        clientes:cliente_id(nombre),
        proveedores:proveedor_id(nombre)
      `)
      .eq('id', reciboId)
      .single();

    if (errorRecibo) {
      if (errorRecibo.code === 'PGRST116') return res.status(404).json({ error: 'Recibo no encontrado.' });
      throw errorRecibo;
    }

    const recibo = {
      ...reciboData,
      cliente_nombre: reciboData.clientes?.nombre || null,
      proveedor_nombre: reciboData.proveedores?.nombre || null,
    };

    delete recibo.clientes;
    delete recibo.proveedores;

    // Obtener cheques asociados
    const { data: cheques, error: errorCheques } = await supabase
      .from('recibo_cheques')
      .select('*')
      .eq('recibo_id', reciboId);

    if (errorCheques) throw errorCheques;

    recibo.cheques = cheques;

    res.json(recibo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el recibo.' });
  }
});

// Editar recibo con cheques
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

  try {
    // Actualizar recibo
    const { data: reciboUpdated, error: errorUpdate } = await supabase
      .from('recibos')
      .update({
        numero,
        fecha,
        tipo,
        cliente_id: cliente_id || null,
        proveedor_id: proveedor_id || null,
        factura_id: factura_id || null,
        efectivo: efectivo || 0,
        transferencia: transferencia || 0,
        otros: otros || 0,
        observaciones: observaciones || '',
        total
      })
      .eq('id', reciboId)
      .select()
      .single();

    if (errorUpdate) throw errorUpdate;

    // Borrar cheques viejos
    const { error: errorDeleteCheques } = await supabase
      .from('recibo_cheques')
      .delete()
      .eq('recibo_id', reciboId);

    if (errorDeleteCheques) throw errorDeleteCheques;

    // Insertar cheques nuevos
    if (cheques && cheques.length > 0) {
      const chequesToInsert = cheques.map(c => ({
        recibo_id: reciboId,
        tipo: c.tipo.charAt(0).toUpperCase() + c.tipo.slice(1).toLowerCase(),
        fecha_cobro: c.fechaCobro,
        banco: c.banco,
        numero: c.numero,
        monto: c.monto
      }));

      const { error: errorInsertCheques } = await supabase
        .from('recibo_cheques')
        .insert(chequesToInsert);

      if (errorInsertCheques) throw errorInsertCheques;
    }

    res.json({ mensaje: 'Recibo actualizado correctamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el recibo.' });
  }
});

// Eliminar recibo
router.delete('/:id', verificarToken, async (req, res) => {
  const reciboId = req.params.id;

  try {
    const { data, error } = await supabase
      .from('recibos')
      .delete()
      .eq('id', reciboId)
      .select();

    if (error) throw error;

    if (!data.length) {
      return res.status(404).json({ error: 'Recibo no encontrado.' });
    }

    res.json({ mensaje: 'Recibo eliminado correctamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el recibo.' });
  }
});

module.exports = router;
