const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const authGuard = require('./authGuard');
const enviarCorreo = require('./emailSender');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const fetch = require("node-fetch"); 
const fs = require('fs');




const app = express();
const port = process.env.PORT || 3000;

// Supabase
const supabaseUrl = 'https://tqwvrtnooqaohewzaltk.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
app.post('/api/stripe/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Error al verificar el webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email;
    const cursoId = session.metadata.curso_id;

    // ✅ Faltaba async
    await guardarCursoEnSupabase(email, cursoId);
  }

  console.log('✅ Evento recibido:', event.type);
  res.json({ received: true });
});


// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Limpieza de sesiones activas al iniciar
(async () => {
  await supabase.from('sesiones').delete().eq('activo', true);
})();

// ======================== RUTAS ==========================

// Registro
app.post('/register', async (req, res) => {
  const { name, lastname, age, email, phone, password, confirm_password } = req.body;

  if (!name || !lastname || !age || !email || !phone || !password || !confirm_password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  if (password !== confirm_password) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden' });
  }

  try {
    const { data: existingUser, error: selectError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('correo', email);

    if (selectError) return res.status(500).json({ error: 'Error al verificar el correo' });
    if (existingUser.length > 0) return res.status(409).json({ error: 'El correo ya está registrado' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const { error: insertError } = await supabase.from('usuarios').insert([{
      nombre: name,
      apellido: lastname,
      edad: age,
      correo: email,
      telefono: phone,
      contraseña: hashedPassword
    }]);

    if (insertError) return res.status(500).json({ error: 'Error al registrar el usuario' });

    res.status(200).json({ success: true, redirectTo: '/login.html' });

  } catch (err) {
    res.status(500).json({ error: 'Error del servidor al registrar' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { correo, contraseña } = req.body;

  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('correo', correo);

    if (error || !data || data.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const usuario = data[0];
    const esValida = await bcrypt.compare(contraseña, usuario.contraseña);
    if (!esValida) return res.status(401).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const expTimestamp = new Date(Date.now() + 3600000);
    const { error: sesionError } = await supabase.from('sesiones').insert([{
      user_id: usuario.id,
      token,
      exp: expTimestamp,
      activo: true
    }]);

    if (sesionError) return res.status(500).json({ error: 'Error al guardar sesión' });

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 3600000,
      sameSite: 'lax',
      secure: false
    });

    res.status(200).json({ success: true, usuario: { nombre: usuario.nombre } });

  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Logout
app.post('/logout', async (req, res) => {
  const token = req.cookies.token;

  if (token) {
    await supabase.from('sesiones').update({ activo: false }).eq('token', token);
  }

  res.clearCookie('token');
  res.json({ success: true, message: 'Sesión cerrada' });
});

// Configuración del usuario
app.get('/api/configuracion', authGuard, async (req, res) => {
  try {
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('nombre, apellido, edad, telefono, correo')
      .eq('correo', req.user.correo)
      .single();

    if (error || !usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({ usuario });

  } catch (err) {
    res.status(500).json({ error: 'Error del servidor al obtener datos de configuración' });
  }
});

// Verificación de contraseña actual (por seguridad)
app.post('/api/autenticar-password', async (req, res) => {
  const { correo, contraseña } = req.body;

  try {
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('correo', correo)
      .single();

    if (error || !usuario) return res.status(401).json({ error: "Usuario no encontrado." });

    const match = await bcrypt.compare(contraseña, usuario.contraseña);
    if (!match) return res.status(401).json({ error: "Contraseña incorrecta." });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Cambio directo de contraseña (requiere correo y nueva contraseña)
app.post('/api/cambiar-password', async (req, res) => {
  const { correo, nueva } = req.body;

  if (!correo || !nueva) {
    return res.status(400).json({ error: "Correo y nueva contraseña requeridos." });
  }

  try {
    const hash = await bcrypt.hash(nueva, 10);
    const { error } = await supabase
      .from('usuarios')
      .update({ contraseña: hash })
      .eq('correo', correo);

    if (error) return res.status(500).json({ error: "No se pudo actualizar la contraseña." });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Ruta protegida para pruebas
app.get('/api/test-auth', authGuard, (req, res) => {
  res.json({ success: true, user: req.user });
});

// Ruta básica protegida
app.get('/api/mi-cuenta', authGuard, (req, res) => {
  res.json({ mensaje: `Hola ${req.user.nombre}, bienvenido a tu cuenta.` });
});

// al inicio del archivo 


// en tus endpoints:
app.post('/api/enviar-recuperacion', async (req, res) => {
  const { correo } = req.body;

   
  if (!correo || !correo.includes('@')) {
    return res.status(400).json({ error: "Correo inválido o no proporcionado" });
  }

  try {
    const { data: usuario, error1 } = await supabase
      .from('usuarios')
      .select('id')
      .eq('correo', correo)
      .single();

    if (error1 || !usuario) {
      return res.status(404).json({ error: "El correo no está registrado" });
    }

    const codigo = Math.floor(100000 + Math.random() * 900000);

    const asunto = "Código para restablecer tu contraseña";
    const html = `
      <p>Tu código de recuperación es:</p>
      <h2>${codigo}</h2>
    `;

    await enviarCorreo({
      to: correo,
      subject: asunto,
      html,
    });

    const { error } = await supabase
      .from('recuperacion')
      .upsert({
        correo,
        codigo,
        expiracion: new Date(Date.now() + 15 * 60 * 1000)
      });

if (error) {
  console.error("Error al insertar código:", error);
} else {
  console.log("✅ Código insertado correctamente para:", correo);
}

     res.json({ success: true, mensaje: "Código enviado" });

  } catch (err) {
    console.error("Error enviando correo:", err);
    res.status(500).json({ error: "No se pudo enviar el correo" });
  }
});

// Ruta para verificar el código de recuperación con expiración
app.post('/api/verificar-codigo', async (req, res) => {
  const { correo, codigo } = req.body;

  if (!correo || !codigo) {
    return res.status(400).json({ error: "Correo y código requeridos." });
  }

  try {
    const { data: codigoData, error } = await supabase
      .from('recuperacion')
      .select('*')
      .eq('correo', correo)
      .single();

    if (error || !codigoData) {
      return res.status(404).json({ error: "No se encontró un código de recuperación para este correo." });
    }

    // Verificar si el código ha expirado
    if (new Date(codigoData.expiracion) < new Date()) {
      return res.status(400).json({ error: "El código ha expirado." });
    }

    if (codigoData.codigo !== parseInt(codigo)) {
      return res.status(400).json({ error: "Código incorrecto." });
    }

    res.json({ success: true, mensaje: "Código verificado con éxito. Ahora puedes cambiar tu contraseña." });

  } catch (err) {
    res.status(500).json({ error: "Error interno del servidor al verificar el código." });
  }
});

// Ruta para cambiar la contraseña después de verificar el código
app.post('/api/cambiar-password-recuperacion', async (req, res) => {
  const { correo, nueva, codigo } = req.body;

  if (!correo || !nueva || !codigo) {
    return res.status(400).json({ error: "Correo, nueva contraseña y código requeridos." });
  }

  try {
    const { data: codigoData, error } = await supabase
      .from('recuperacion')
      .select('*')
      .eq('correo', correo)
      .single();

    if (error || !codigoData) {
      return res.status(404).json({ error: "No se encontró un código de recuperación para este correo." });
    }

    if (codigoData.codigo !== parseInt(codigo)) {
      return res.status(400).json({ error: "Código incorrecto." });
    }

    // Verificar si el código ha expirado
    if (new Date(codigoData.expiracion) < new Date()) {
      return res.status(400).json({ error: "El código ha expirado." });
    }

    // Actualizar la contraseña
    const hashedPassword = await bcrypt.hash(nueva, 10);
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ contraseña: hashedPassword })
      .eq('correo', correo);

    if (updateError) return res.status(500).json({ error: "No se pudo actualizar la contraseña." });

    // Eliminar el código de recuperación después de usarlo
    await supabase.from('recuperacion').delete().eq('correo', correo);

      const { data: usuario, error: userError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('correo', correo)
        .single();

      if (userError || !usuario) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }


    res.json({ success: true, mensaje: "Contraseña actualizada con éxito." });

  } catch (err) {
    res.status(500).json({ error: "Error interno del servidor al cambiar la contraseña." });
  }
});

// Actualizar datos del usuario
app.patch('/api/configuracion', authGuard, async (req, res) => {
  const { nombre, apellido, edad, telefono, correo } = req.body;

  if (!nombre || !apellido || !edad || !telefono || !correo) {
    return res.status(400).json({ error: "Todos los campos son obligatorios." });
  }

  try {
    const { error } = await supabase
      .from('usuarios')
      .update({ nombre, apellido, edad, telefono })
      .eq('correo', req.user.correo);

    if (error) return res.status(500).json({ error: "Error al actualizar los datos." });

    res.json({ success: true, mensaje: "Datos actualizados correctamente." });
  } catch (err) {
    res.status(500).json({ error: "Error interno del servidor." });
  }
});


app.post('/api/actualizar-campo', authGuard, async (req, res) => {
  const { campo, valor } = req.body;

  const camposValidos = ['nombre', 'apellido', 'edad', 'telefono', 'correo'];
  if (!campo || !valor || !camposValidos.includes(campo)) {
    return res.status(400).json({ error: "Campo inválido." });
  }

  try {
    const { error } = await supabase
      .from('usuarios')
      .update({ [campo]: valor })
      .eq('correo', req.user.correo);  // usuario autenticado

    if (error) {
      return res.status(500).json({ error: "Error al actualizar el campo." });
    }

    res.json({ success: true, mensaje: "Campo actualizado correctamente." });
  } catch (err) {
    res.status(500).json({ error: "Error del servidor." });
  }
});







// ejemplo básico en Express



// Esta función la defines tú
async function guardarCursoEnSupabase(email, cursoId) {
  try {
    // Busca al usuario
    const { data: user, error } = await supabase
      .from('usuarios')
      .select('id')
      .eq('correo', email)
      .single();

    if (error || !user) {
      console.error('Usuario no encontrado');
      return;
    }

    // Registra la compra en una tabla "cursos_comprados"
    const { error: insertError } = await supabase
      .from('cursos_comprados')
      .insert([
        { user_id: user.id, curso_id: cursoId }
      ]);

    if (insertError) {
      console.error('Error al guardar curso:', insertError);
    } else {
      console.log('✅ Curso registrado correctamente');
    }
  } catch (err) {
    console.error('Error interno al guardar curso:', err);
  }
}

app.post('/api/checkout/curso1', authGuard, async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: req.user.correo,  // desde tu auth
    line_items: [
      {
        price: 'price_1RPFkgFVmbFMS5SiIryPanAE', // tu precio real de Stripe
        quantity: 1,
      },
    ],
    metadata: {
      curso_id: 'curso1' // puedes identificar el curso comprado
    },
    success_url: 'https://vogot.onrender.com/index.html',
    cancel_url: 'https://vogot.onrender.com/index.html',
  });

  res.json({ url: session.url });
});


app.post('/api/checkout/curso2', authGuard, async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: req.user.correo,  // desde tu auth
    line_items: [
      {
        price: 'price_1RPNMYFVmbFMS5SiYIAwRam3', // tu precio real de Stripe
        quantity: 1,
      },
    ],
    metadata: {
      curso_id: 'curso2' // puedes identificar el curso comprado
    },
    success_url: 'https://vogot.onrender.com/index.html',
    cancel_url: 'https://vogot.onrender.com/index.html',
  });

  res.json({ url: session.url });
});


app.post('/api/checkout/curso3', authGuard, async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: req.user.correo,  // desde tu auth
    line_items: [
      {
        price: 'price_1RPNN8FVmbFMS5SiJ4KNUdry', // tu precio real de Stripe
        quantity: 1,
      },
    ],
    metadata: {
      curso_id: 'curso3' // puedes identificar el curso comprado
    },
    success_url: 'https://vogot.onrender.com/index.html',
    cancel_url: 'https://vogot.onrender.com/index.html',
  });

  res.json({ url: session.url });
});


app.post('/api/checkout/curso4', authGuard, async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: req.user.correo,  // desde tu auth
    line_items: [
      {
        price: 'price_1RPNNaFVmbFMS5Si61Y5xQ5u', // tu precio real de Stripe
        quantity: 1,
      },
    ],
    metadata: {
      curso_id: 'curso4' // puedes identificar el curso comprado
    },
    success_url: 'https://vogot.onrender.com/index.html',
    cancel_url: 'https://vogot.onrender.com/index.html',
  });

  res.json({ url: session.url });
});

app.post('/api/checkout/curso5', authGuard, async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: req.user.correo,  // desde tu auth
    line_items: [
      {
        price: 'price_1RPNO1FVmbFMS5SiMij3n6GL', // tu precio real de Stripe
        quantity: 1,
      },
    ],
    metadata: {
      curso_id: 'curso5' // puedes identificar el curso comprado
    },
    success_url: 'https://vogot.onrender.com/index.html',
    cancel_url: 'https://vogot.onrender.com/index.html',
  });

  res.json({ url: session.url });
});



app.get('/curso1', authGuard, async (req, res) => {
  const cursoId = 'curso1';
  const userId = req.user.id;

  const { data: registro, error } = await supabase
    .from('cursos_comprados')
    .select('*')
    .eq('user_id', userId)
    .eq('curso_id', cursoId)
    .single();

  if (error || !registro) {
    return res.status(403).send('No tienes acceso a este curso');
  }

  // Si tiene acceso, enviamos el HTML del curso
  res.sendFile(path.join(__dirname, 'private', 'curso1.html'));
});

app.get('/curso2', authGuard, async (req, res) => {
  const cursoId = 'curso2';
  const userId = req.user.id;

  const { data: registro, error } = await supabase
    .from('cursos_comprados')
    .select('*')
    .eq('user_id', userId)
    .eq('curso_id', cursoId)
    .single();

  if (error || !registro) {
    return res.status(403).send('No tienes acceso a este curso');
  }

  res.sendFile(path.join(__dirname, 'private', 'curso2.html'));
});

app.get('/curso3', authGuard, async (req, res) => {
  const cursoId = 'curso3';
  const userId = req.user.id;

  const { data: registro, error } = await supabase
    .from('cursos_comprados')
    .select('*')
    .eq('user_id', userId)
    .eq('curso_id', cursoId)
    .single();

  if (error || !registro) {
    return res.status(403).send('No tienes acceso a este curso');
  }

  res.sendFile(path.join(__dirname, 'private', 'curso3.html'));
});

app.get('/curso4', authGuard, async (req, res) => {
  const cursoId = 'curso4';
  const userId = req.user.id;

  const { data: registro, error } = await supabase
    .from('cursos_comprados')
    .select('*')
    .eq('user_id', userId)
    .eq('curso_id', cursoId)
    .single();

  if (error || !registro) {
    return res.status(403).send('No tienes acceso a este curso');
  }

  res.sendFile(path.join(__dirname, 'private', 'curso4.html'));
});

app.get('/curso5', authGuard, async (req, res) => {
  const cursoId = 'curso5';
  const userId = req.user.id;

  const { data: registro, error } = await supabase
    .from('cursos_comprados')
    .select('*')
    .eq('user_id', userId)
    .eq('curso_id', cursoId)
    .single();

  if (error || !registro) {
    return res.status(403).send('No tienes acceso a este curso');
  }

  res.sendFile(path.join(__dirname, 'private', 'curso5.html'));
});

app.get('/api/cursos-comprados', authGuard, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cursos_comprados')
      .select('curso_id')
      .eq('user_id', req.user.id);  // Usuario autenticado

    if (error) return res.status(500).json({ error: 'Error al obtener los cursos' });

    const cursosComprados = data.map(c => c.curso_id);
    res.json({ cursos: cursosComprados });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post("/api/chat", async (req, res) => {
  const userMsg = req.body.message;

  try {
    const response = await fetch("https://dev-academy.n8n.itelisoft.org/webhook/aureliopath1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMsg })
    });

    const text = await response.text(); // Es texto plano (ej: "¡Hola! ¿Cómo estás?")
    console.log("Raw response:", text);

    res.json({ reply: text }); // Aquí lo empaquetamos como JSON
  } catch (err) {
    console.error("Error en el backend:", err);
    res.status(500).json({ reply: "Hubo un error al contactar con el asistente." });
  }
});

// Ruta protegida para servir PDFs
app.get("/descargar/:archivo", (req, res) => {
  const archivo = req.params.archivo;

  // Verificar que el usuario tiene acceso (aquí debes poner tu lógica de auth)
  const usuarioAutorizado = true; // Simulación

  if (!usuarioAutorizado) {
    return res.status(403).send("No autorizado");
  }

  // Ruta absoluta al archivo PDF
  const rutaArchivo = path.join(__dirname, "private", "presentaciones", archivo);

  // Verificar si existe
  if (!fs.existsSync(rutaArchivo)) {
    return res.status(404).send("Archivo no encontrado");
  }

  // Enviar el PDF como descarga o inline
  res.sendFile(rutaArchivo);
});


app.use('/webhook', express.raw({ type: 'application/json' })); // solo raw para /webhook
app.use(express.json()); // para el resto



// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en puerto http://localhost:${port}`);
});

module.exports = app; 
