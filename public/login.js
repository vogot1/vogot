document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = document.getElementById('correo').value;
    const password = document.getElementById('contraseña').value;

    if (!email || !password) {
      alert('Por favor, ingresa tu correo y contraseña.');
      return;
    }

    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ correo: email, contraseña: password }),
      });

      const result = await response.json();

      if (result.success) {

        // ✅ Redirigir al index
        window.location.href = result.redirectTo || '/index.html';
      } else {
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: result.error || 'Error al iniciar sesión',
          });
        } else {
          alert(result.error || 'Error al iniciar sesión');
        }
      }
    } catch (error) {
      alert('Hubo un problema con la conexión. Intenta de nuevo más tarde.');
      console.error('Error de conexión:', error);
    }
  });

  document.getElementById('forgot-password-login').addEventListener('click', () => {
  document.getElementById('recovery-modal').classList.remove('hidden');
  document.getElementById('recovery-modal').classList.add('show');
});

document.getElementById('close-recovery-modal').addEventListener('click', () => {
  document.getElementById('recovery-modal').classList.remove('show');
  document.getElementById('recovery-modal').classList.add('hidden');
  resetRecoveryModal();
});

let recoveryEmail = "";

document.getElementById('send-recovery-code').addEventListener('click', async () => {
  const email = document.getElementById('recovery-email').value;
  const msg = document.getElementById('recovery-message');
  msg.textContent = "";

  if (!email) return msg.textContent = "Ingresa tu correo.";

  const res = await fetch('/api/enviar-recuperacion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: email })
  });

  const data = await res.json();

  if (res.ok && data.mensaje === "Código enviado") {
    recoveryEmail = email;
    document.getElementById('step-email').classList.add('hidden');
    document.getElementById('step-code').classList.remove('hidden');
  } else {
    msg.textContent = data.error || "Error al enviar el código.";
  }
});

document.getElementById('verify-recovery-code').addEventListener('click', async () => {
  const code = document.getElementById('recovery-code').value;
  const msg = document.getElementById('recovery-message');
  msg.textContent = "";

  const res = await fetch('/api/verificar-codigo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: recoveryEmail, codigo: code })
  });

  const data = await res.json();

  if (res.ok && data.success) {
    document.getElementById('step-code').classList.add('hidden');
    document.getElementById('step-new-pass').classList.remove('hidden');
  } else {
    msg.textContent = data.error || "Código incorrecto.";
  }
});

document.getElementById('submit-new-password').addEventListener('click', async () => {
  const newPassword = document.getElementById('new-recovery-password').value;
  const code = document.getElementById('recovery-code').value;
  const msg = document.getElementById('recovery-message');
  msg.textContent = "";

  if (!newPassword) return msg.textContent = "Ingresa tu nueva contraseña.";

  const res = await fetch('/api/cambiar-password-recuperacion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      correo: recoveryEmail,
      nueva: newPassword,
      codigo: code
    })
  });

  const data = await res.json();

  if (res.ok) {
    msg.textContent = "Contraseña restablecida. Ya puedes iniciar sesión.";
    setTimeout(() => {
      document.getElementById('recovery-modal').classList.remove('show');
      document.getElementById('recovery-modal').classList.add('hidden');
      resetRecoveryModal();
    }, 2000);
  } else {
    msg.textContent = data.error || "No se pudo restablecer la contraseña.";
  }
});

function resetRecoveryModal() {
  recoveryEmail = "";
  document.getElementById('recovery-email').value = "";
  document.getElementById('recovery-code').value = "";
  document.getElementById('new-recovery-password').value = "";
  document.getElementById('recovery-message').textContent = "";

  ['step-email', 'step-code', 'step-new-pass'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });

  document.getElementById('step-email').classList.remove('hidden');
}

});
