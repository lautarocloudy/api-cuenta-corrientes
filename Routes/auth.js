// routes/auth.js
const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient'); // reemplaza pool por supabase
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Login
router.post('/login', async (req, res) => {
  const { email, contraseña } = req.body;

  if (!email || !contraseña) {
    return res.status(400).json({ error: 'Email y contraseña obligatorios.' });
  }

  try {
    // Buscar el usuario por email
    const { data: user, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .maybeSingle(); // devuelve null si no encuentra

    if (error) throw error;

    if (!user) {
      return res.status(400).json({ error: 'Usuario no encontrado.' });
    }

    // Verificar contraseña
    const valid = await bcrypt.compare(contraseña, user.contraseña);
    if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta.' });

    // Generar token JWT
    const token = jwt.sign({ id: user.id, rol: user.rol }, process.env.JWT_SECRET);

    res.json({
      token,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol
      }
    });
  } catch (err) {
    console.error('Error en login:', err.message);
    res.status(500).json({ error: 'Error en el servidor.' });
  }
});

module.exports = router;
