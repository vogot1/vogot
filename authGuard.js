require('dotenv').config();
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const authGuard = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) return res.status(401).json({ error: 'No autenticado' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Validar sesión activa
    const { data: sesion, error: sesionError } = await supabase
      .from('sesiones')
      .select('*')
      .eq('token', token)
      .eq('activo', true)
      .single();

    if (sesionError || !sesion) {
      return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }

    // Buscar usuario por correo
    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select('id, correo')
      .eq('correo', decoded.correo)
      .single();

    if (usuarioError || !usuario) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    req.user = {
      id: usuario.id,
      correo: usuario.correo
    };

    next();
  } catch (err) {
    console.error("Error de autenticación:", err);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

module.exports = authGuard;
