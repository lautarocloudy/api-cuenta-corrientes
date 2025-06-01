const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const bcrypt = require('bcrypt');
const verificarToken = require('../middlewares/authMiddleware');

// Obtener todos los usuarios
router.get('/', verificarToken, async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, email, rol')
    .order('id');

  if (error) return res.status(500).json({ error: 'Error al obtener usuarios' });
  res.json(data);
});

// Obtener un usuario por ID
router.get('/:id', verificarToken, async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, email, rol')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(data);
});

// Crear un nuevo usuario
router.post('/', async (req, res) => {
  const { nombre, email, contraseña, rol } = req.body;
  if (!nombre || !email || !contraseña) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
  }

  const { data: existente, error: errExistente } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (errExistente) return res.status(500).json({ error: 'Error al verificar email existente' });
  if (existente) return res.status(400).json({ error: 'El email ya está registrado' });

  const hash = await bcrypt.hash(contraseña, 10);

  const { error } = await supabase
    .from('usuarios')
    .insert([{ nombre, email, contraseña: hash, rol: rol || 'usuario' }]);

  if (error) return res.status(500).json({ error: 'Error al crear el usuario' });
  res.json({ mensaje: 'Usuario creado correctamente' });
});

// Actualizar usuario
router.put('/:id', verificarToken, async (req, res) => {
  const { nombre, email, rol } = req.body;

  const { data, error } = await supabase
    .from('usuarios')
    .update({ nombre, email, rol })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ mensaje: 'Usuario actualizado', usuario: data });
});

// Eliminar usuario
router.delete('/:id', verificarToken, async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios')
    .delete()
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ mensaje: 'Usuario eliminado correctamente' });
});

// Establecer nueva contraseña sin pedir la actual
router.put('/:id/set-password', verificarToken, async (req, res) => {
  const { nueva } = req.body;
  const id = req.params.id;

  if (!nueva) return res.status(400).json({ error: 'Debés enviar la nueva contraseña.' });

  const hashNueva = await bcrypt.hash(nueva, 10);

  const { error } = await supabase
    .from('usuarios')
    .update({ contraseña: hashNueva })
    .eq('id', id);

  if (error) return res.status(500).json({ error: 'Error al actualizar la contraseña.' });
  res.json({ mensaje: 'Contraseña actualizada sin verificación de clave anterior.' });
});

module.exports = router;
