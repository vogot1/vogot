document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("register-form");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById('register-name').value;
    const lastname = document.getElementById('register-lastname').value;
    const age = document.getElementById('register-age').value;
    const email = document.getElementById('register-email').value;
    const phone = document.getElementById('register-phone').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const termsAccepted = document.getElementById('accept-terms').checked;

    if (!termsAccepted) {
      return Swal.fire({
        icon: 'warning',
        title: 'Términos no aceptados',
        text: 'Debes aceptar los términos y condiciones para continuar.'
      });
    }

    if (password !== confirmPassword) {
      return Swal.fire({
        icon: 'warning',
        title: '¡Oops!',
        text: 'Las contraseñas no coinciden'
      });
    }

    try {
      const response = await fetch('/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          lastname,
          age,
          email,
          phone,
          password,
          confirm_password: confirmPassword
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        Swal.fire({
          icon: 'success',
          title: '¡Registro exitoso!',
          text: 'Redirigiendo al login...',
          timer: 2000,
          showConfirmButton: false
        }).then(() => {
          window.location.href = result.redirectTo;
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error al registrar',
          text: result.error || 'Algo salió mal'
        });
      }

    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error de conexión',
        text: 'No se pudo conectar al servidor'
      });
    }
  });

  // Mostrar términos y aviso de privacidad
  document.getElementById('show-terms').addEventListener('click', (e) => {
    e.preventDefault();
    Swal.fire({
      title: 'Términos y condiciones',
      html: `
        <p>Al registrarte, aceptas utilizar esta plataforma de forma responsable.</p>
        <p>Este sitio es solo para fines educativos. No se permite el uso malicioso.</p>
        <p>Nos reservamos el derecho de suspender cuentas si se violan estas condiciones.</p>
      `,
      icon: 'info',
      confirmButtonText: 'Entendido'
    });
  });

  document.getElementById('show-privacy').addEventListener('click', (e) => {
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
});
