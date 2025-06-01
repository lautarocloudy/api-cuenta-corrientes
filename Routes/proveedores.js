const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const verificarToken = require('../middlewares/authMiddleware');

// Obtener todos los proveedores
router.get('/', verificarToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
});

// Obtener proveedor por ID
router.get('/:id', verificarToken, async (req, res) => {
  const id = req.params.id;
  try {
    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Proveedor no encontrado' });
      throw error;
    }

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener proveedor' });
  }
});

// Crear nuevo proveedor (con validación de CUIT único)
router.post('/', verificarToken, async (req, res) => {
  const { nombre, domicilio, cuit, email, telefono } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });

  try {
    if (cuit) {
      const { data: cuitExistente, error: errorCuit } = await supabase
        .from('proveedores')
        .select('*')
        .eq('cuit', cuit);

      if (errorCuit) throw errorCuit;

      if (cuitExistente.length > 0) {
        return res.status(400).json({ error: 'El CUIT ya está registrado.' });
      }
    }

    const { data, error } = await supabase
      .from('proveedores')
      .insert([{ nombre, domicilio, cuit, email, telefono }]);

    if (error) throw error;

    res.json({ mensaje: 'Proveedor creado correctamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear proveedor.' });
  }
});

// Actualizar proveedor (con validación de CUIT único)
router.put('/:id', verificarToken, async (req, res) => {
  const id = req.params.id;
  const { nombre, domicilio, cuit, email, telefono } = req.body;

  try {
    if (cuit) {
      const { data: cuitExistente, error: errorCuit } = await supabase
        .from('proveedores')
        .select('*')
        .eq('cuit', cuit)
        .neq('id', id);

      if (errorCuit) throw errorCuit;

      if (cuitExistente.length > 0) {
        return res.status(400).json({ error: 'El CUIT ya pertenece a otro proveedor.' });
      }
    }

    const { data, error } = await supabase
      .from('proveedores')
      .update({ nombre, domicilio, cuit, email, telefono })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Proveedor no encontrado.' });
      throw error;
    }

    res.json({ mensaje: 'Proveedor actualizado.', proveedor: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar proveedor.' });
  }
});

// Eliminar proveedor
router.delete('/:id', verificarToken, async (req, res) => {
  const id = req.params.id;
  try {
    const { data, error } = await supabase
      .from('proveedores')
      .delete()
      .eq('id', id)
      .select();

    if (error) throw error;

    if (!data.length) return res.status(404).json({ error: 'Proveedor no encontrado' });

    res.json({ mensaje: 'Proveedor eliminado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar proveedor' });
  }
});

module.exports = router;
