// routes/clientes.js
const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const verificarToken = require('../middlewares/authMiddleware');

// Obtener todos los clientes
router.get('/', verificarToken, async (req, res) => {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al obtener clientes' });
  }
  res.json(data);
});

// Obtener cliente por ID
router.get('/:id', verificarToken, async (req, res) => {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // No encontrado
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Error al obtener cliente' });
  }
  res.json(data);
});

// Crear nuevo cliente (con validación de CUIT único)
router.post('/', verificarToken, async (req, res) => {
  const { nombre, domicilio, cuit, email, telefono } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });

  try {
    if (cuit) {
      const { data: cuitExistente, error: err } = await supabase
        .from('clientes')
        .select('id')
        .eq('cuit', cuit)
        .limit(1);

      if (err) throw err;
      if (cuitExistente.length > 0) {
        return res.status(400).json({ error: 'El CUIT ya está registrado.' });
      }
    }

    const { data, error } = await supabase
      .from('clientes')
      .insert([{ nombre, domicilio, cuit, email, telefono }]);

    if (error) throw error;

    res.json({ mensaje: 'Cliente creado correctamente.', cliente: data[0] });
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
      const { data: cuitExistente, error: err } = await supabase
        .from('clientes')
        .select('id')
        .eq('cuit', cuit)
        .neq('id', id)
        .limit(1);

      if (err) throw err;
      if (cuitExistente.length > 0) {
        return res.status(400).json({ error: 'El CUIT ya pertenece a otro cliente.' });
      }
    }

    const { data, error } = await supabase
      .from('clientes')
      .update({ nombre, domicilio, cuit, email, telefono })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Cliente no encontrado.' });
      }
      throw error;
    }

    res.json({ mensaje: 'Cliente actualizado.', cliente: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar cliente.' });
  }
});

// Eliminar cliente
router.delete('/:id', verificarToken, async (req, res) => {
  const id = req.params.id;
  const { data, error } = await supabase
    .from('clientes')
    .delete()
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Error al eliminar cliente' });
  }

  res.json({ mensaje: 'Cliente eliminado correctamente', cliente: data });
});

module.exports = router;
