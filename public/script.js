function verMas() {
  document.getElementById("cursos").scrollIntoView({ behavior: "smooth" });
}

function isAuthenticated() {
  return !!localStorage.getItem('user');
}

function guardarUsuario(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

async function mostrarUsuario() {
  const userData = localStorage.getItem('user');
  const userIcon = document.getElementById('user-icon');
  const userMenu = document.getElementById('user-menu');
  const userNameEl = document.getElementById('user-name');
  const logoutBtn = document.getElementById('logout-btn');
  const configBtn = document.getElementById('config-btn');

  const sesionValida = await verificarSesionActiva();

  if (userData && sesionValida) {
    const user = JSON.parse(userData);
    userNameEl.textContent = `Hola, ${user.nombre || user.correo || 'Usuario'}`;
    userMenu.style.display = 'none';

    // Toggle menú con clic
    userIcon.addEventListener('click', () => {
      const isVisible = userMenu.style.display === 'block';
      userMenu.style.display = isVisible ? 'none' : 'block';
    });

    // 👇 Esto es un segundo error: estás usando await dentro de un callback.
    // Los callbacks de eventos no pueden ser await directamente como lo tienes.
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/logout', {
          method: 'POST',
          credentials: 'include'
        });
        localStorage.removeItem('user');
        window.location.reload();
      } catch (err) {
        console.error("Error al cerrar sesión", err);
      }
    });

    // Configuración (futuro)
    configBtn.addEventListener('click', () => {
      window.open('/configuracion.html', '_blank');
    });

    // Cerrar menú si se hace clic fuera
    document.addEventListener('click', (e) => {
      if (!document.getElementById('user-container').contains(e.target)) {
        userMenu.style.display = 'none';
      }
    });
  } else {
    // Si no hay sesión, redirige al login al hacer clic en el ícono
    const userContainer = document.getElementById('user-container');
    userContainer.addEventListener('click', () => {
      window.location.href = '/login.html';
      localStorage.removeItem('user');
    });
  }
}


function manejarBotonCompra() {
  const botonesComprar = document.querySelectorAll('.btn-comprar');

  botonesComprar.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const cursoId = btn.dataset.id;

      const sesionValida = await verificarSesionActiva();
      if (!sesionValida) {
        localStorage.removeItem('user');
        window.location.href = '/login.html';
        return;
      }

      try {
        const res = await fetch(`/api/checkout/${cursoId}`, {
          method: 'POST',
          credentials: 'include'
        });

        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          console.warn('No se obtuvo URL del checkout');
        }
      } catch (err) {
        console.error('Error en el proceso de compra', err);
      }
    });
  });
}



document.addEventListener('DOMContentLoaded', init);

async function init() {
  await verificarSesion();
  await mostrarUsuario();
  manejarBotonCompra();

  const cursos = ['curso1', 'curso2', 'curso3','curso4','curso5'];
  cursos.forEach(cursoId => {
    mostrarBotonCurso(cursoId);
    const btn = document.getElementById(`ver-${cursoId}`);
    if (btn) {
      btn.addEventListener('click', () => {
        window.location.href = `/${cursoId}`;
      });
    }
  });
}


async function verificarSesion() {
  try {
    const res = await fetch('/api/test-auth', {
      method: 'GET',
      credentials: 'include' // IMPORTANTE: para enviar cookies
    });

    if (res.ok) {
      const data = await res.json();
      guardarUsuario(data.user); // opcional si quieres actualizar localStorage
      console.log('Usuario autenticado:', data.user);
    } else {
      localStorage.removeItem('user');
      console.log('Sesión no válida o expirada');
    }
  } catch (err) {
    console.error('Error al verificar la sesión', err);
  }
}

async function verificarSesionActiva() {
  try {
    const res = await fetch('/api/mi-cuenta', {
      method: 'GET',
      credentials: 'include' // importante para enviar cookies
    });

    if (res.ok) {
      const data = await res.json();
      console.log("Sesión válida:", data);
      return true;
    } else {
      localStorage.removeItem('user'); // 💡 limpia si ya no es válida
      return false;
    }
  } catch (err) {
    console.error("Error al verificar sesión:", err);
    return false;
  }
}

document.getElementById('footer-terms').addEventListener('click', function(e) {
  e.preventDefault();
  Swal.fire({
    title: 'Términos y condiciones',
html: `
  <p>Al usar esta plataforma, aceptas utilizarla de forma responsable.</p>
  <p>Este sitio es solo para fines educativos. No se permite el uso malicioso.</p>
  <p>Nos reservamos el derecho de suspender cuentas si se violan estas condiciones.</p>
`,
n: 'info',
    confirmButtonText: 'Entendido'
  });
});

document.getElementById('footer-privacy').addEventListener('click', function(e) {
  e.preventDefault();
  Swal.fire({
    title: 'Aviso de privacidad',
html: `
  <p>Tu información personal se usará únicamente para propósitos relacionados con el sitio.</p>
  <p>No compartiremos tus datos con terceros.</p>
  <p>Puedes solicitar la eliminación de tu cuenta en cualquier momento.</p>
`,

    icon: 'info',
    confirmButtonText: 'Entendido'
  });
});



async function mostrarBotonCurso(cursoId) {
  try {
    const res = await fetch(`/api/curso-status/${cursoId}`, {
      credentials: 'include'
    });

    const data = await res.json();
    const btnVer = document.getElementById(`ver-${cursoId}`);
    const btnComprar = document.getElementById(`comprar-${cursoId}`);

    if (!btnVer || !btnComprar) {
      console.error('No se encontraron los botones en el DOM.');
      return;
    }

    if (data.tieneCurso) {
      btnVer.style.display = 'inline-block';
      btnComprar.style.display = 'none';
    } else {
      btnComprar.style.display = 'inline-block';
      btnVer.style.display = 'none';
    }
  } catch (err) {
    console.error('Error al verificar acceso al curso:', err);
  }
}


async function mostrarBotonesCurso() {
  const res = await fetch('/api/cursos-comprados');
  const data = await res.json();
  const cursosComprados = data.cursos;

  // Recorres tus botones de curso en el HTML
  cursosComprados.forEach(cursoId => {
    const boton = document.querySelector(`#ver-${cursoId}`); // Ej: <button id="ver-curso1">
    if (boton) {
      boton.style.display = 'inline-block';  // Muestra botón
    }
  });
}


async function actualizarBotonesCurso() {
  const res = await fetch('/api/cursos-comprados');
  const data = await res.json();
  const cursosComprados = data.cursos;

  cursosComprados.forEach(cursoId => {
    const verBtn = document.querySelector(`#ver-${cursoId}`);
    const comprarBtn = document.querySelector(`#comprar-${cursoId}`);

    if (verBtn) verBtn.style.display = 'inline-block';
    if (comprarBtn) comprarBtn.style.display = 'none'; // ⛔️ Oculta el botón de compra
  });
}

actualizarBotonesCurso();


mostrarBotonesCurso();

const chatBox = document.getElementById("chat-box");
const chatToggle = document.getElementById("chat-toggle");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

// Mostrar / ocultar chat
chatToggle.addEventListener("click", () => {
  chatBox.classList.toggle("hidden");
});

// Enviar mensaje
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userMsg = chatInput.value.trim();
  if (!userMsg) return;

  addMessage("Tú", userMsg);
  chatInput.value = "";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMsg })
    });

    const data = await response.json();
    const botReply = data.reply || "Lo siento, no entendí eso.";
    addMessage("Bot", botReply);
  } catch (err) {
    console.error("Error al conectar con el servidor", err);
    addMessage("Bot", "Hubo un error al conectar con el servidor.");
  }
});

function addMessage(sender, text) {
  const msgDiv = document.createElement("div");
  msgDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
