document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM completamente cargado");

  let correoUsuario = null;
  let recoveryEmail = null;
  let campoPendiente = null;
  let valorPendiente = null;

  

  // ========== CARGAR DATOS DEL USUARIO ==========
  fetch('/api/configuracion')
    .then(res => {
      if (!res.ok) throw new Error();
      return res.json();
    })
    .then(({ usuario }) => {
      correoUsuario = usuario.correo;
      ["nombre", "apellido", "edad", "telefono", "correo"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = usuario[id];
      });
    })
    .catch(() => alert("Error al cargar la información del usuario."));

  // ========== ELEMENTOS ==========
  const changeModal = document.getElementById("change-password-modal");
  const changeMsg = document.getElementById("change-password-message");

  const changePasswordBtn = document.getElementById("change-password-btn");
  const closeChangeModal = document.getElementById("close-change-modal");
  const submitChangePassword = document.getElementById("submit-change-password");
  const authenticatePassword = document.getElementById("authenticate-password");

  const stepCurrentPassword = document.getElementById("step-current-password");
  const stepNewPassword = document.getElementById("step-new-password");

  const forgotPasswordLink = document.getElementById("forgot-password-link");
  const forgotStep = document.getElementById("step-forgot-password");
  const forgotEmailInput = document.getElementById("forgot-email");
  const submitForgotBtn = document.getElementById("submit-forgot-password");

  const codeStep = document.getElementById("step-code-verification");
  const codeInput = document.getElementById("recovery-code");
  const verifyCodeBtn = document.getElementById("verify-code-btn");
  const codeError = document.getElementById("code-error-message");

  const stepNewPasswordReset = document.getElementById("step-new-password-reset");
  const newPasswordResetInput = document.getElementById("new-password-reset");
  const submitResetPassword = document.getElementById("submit-reset-password");
  const resetPasswordMsg = document.getElementById("reset-password-message");

  // ========== MODAL ==========
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener("click", () => {
      changeModal.classList.add("show");
      changeModal.classList.remove("hidden");
      changeMsg.textContent = "";
      resetSteps();
    });
  }

  if (closeChangeModal) {
    closeChangeModal.addEventListener("click", () => {
      changeModal.classList.remove("show");
      changeModal.classList.add("hidden");
      changeMsg.textContent = "";
      resetSteps();
    });
  }

  // ========== AUTENTICACIÓN CONTRASEÑA ACTUAL ==========
  if (authenticatePassword) {
    authenticatePassword.addEventListener("click", async () => {
      const currentPassword = document.getElementById("current-password").value;
      changeMsg.textContent = "";

      if (!currentPassword) {
        return changeMsg.textContent = "Ingresa tu contraseña actual.";
      }

      const res = await fetch('/api/autenticar-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: correoUsuario,
          contraseña: currentPassword
        })
      });

      const data = await res.json();
      if (res.ok) {
        if (campoPendiente && valorPendiente) {
         await actualizarCampoUsuario();
          campoPendiente = null;
          valorPendiente = null;
          changeModal.classList.add("hidden"); // Cierra modal
        } else {
          // ← el cambio es para contraseña
          stepCurrentPassword.classList.add("hidden");
          stepNewPassword.classList.remove("hidden");
        }
      } else {
        changeMsg.textContent = data.error || "Contraseña incorrecta.";
      }

    });
  }

  // ========== GUARDAR NUEVA CONTRASEÑA ==========
  if (submitChangePassword) {
    submitChangePassword.addEventListener("click", async () => {
      const newPassword = document.getElementById("new-password-auth").value;
      changeMsg.textContent = "";

      if (!newPassword) {
        return changeMsg.textContent = "Ingresa la nueva contraseña.";
      }

      const res = await fetch('/api/cambiar-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: correoUsuario,
          nueva: newPassword
        })
      });

      const data = await res.json();
      changeMsg.textContent = res.ok
        ? "Contraseña actualizada correctamente."
        : data.error || "No se pudo actualizar la contraseña.";
    });
  }

  // ========== FLUJO DE RECUPERACIÓN ==========
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      resetSteps();
      forgotStep.classList.remove("hidden");
      forgotPasswordLink.classList.add("hidden"); // Ocultar el link mientras está el formulario
    });
  }

  if (submitForgotBtn) {
    submitForgotBtn.addEventListener("click", async () => {
      const email = forgotEmailInput.value;
      changeMsg.textContent = "";

      if (!email) {
        return changeMsg.textContent = "Ingresa tu correo.";
      }

      const res = await fetch('/api/enviar-recuperacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: email })
      });

      const data = await res.json();

      if (res.ok && data.mensaje === "Código enviado") {
        recoveryEmail = email;
        forgotStep.classList.add("hidden");
        codeStep.classList.remove("hidden");
      } else {
        changeMsg.textContent = data.error || "No se pudo enviar el código.";
      }
    });
  }

  if (verifyCodeBtn) {
    verifyCodeBtn.addEventListener("click", async () => {
      const code = codeInput.value;
      codeError.textContent = "";

      if (!code) {
        return codeError.textContent = "Ingresa el código.";
      }

      const res = await fetch('/api/verificar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: recoveryEmail, codigo: code })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        codeStep.classList.add("hidden");
        stepNewPasswordReset.classList.remove("hidden");
      } else {
        codeError.textContent = data.error || "Código incorrecto.";
      }
    });
  }

  if (submitResetPassword) {
    submitResetPassword.addEventListener("click", async () => {
      const newPassword = newPasswordResetInput.value;
      const recoveryCode = codeInput.value; // ← vuelve a obtener el código aquí
      resetPasswordMsg.textContent = "";

      if (!newPassword) {
        return resetPasswordMsg.textContent = "Ingresa la nueva contraseña.";
      }

    const res = await fetch('/api/cambiar-password-recuperacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correo: recoveryEmail,  // El correo del usuario
        nueva: newPassword,     // La nueva contraseña
        codigo: recoveryCode    // Asegúrate de pasar el código de recuperación
      })
    });

      const data = await res.json();

      resetPasswordMsg.textContent = res.ok
        ? "Contraseña restablecida correctamente."
        : data.error || "No se pudo restablecer la contraseña.";
    });
  }

  // ========== EDITAR DATOS DE USUARIO ==========  
  document.querySelectorAll(".edit-icon").forEach(icon => {
    icon.addEventListener("click", () => {
      campoPendiente = icon.dataset.campo;
      const span = document.getElementById(campoPendiente);
      const input = document.getElementById("input-" + campoPendiente);
      const button = document.getElementById("guardar-" + campoPendiente);

      // Mostrar el input y el botón para editar
      input.classList.remove("hidden");
      button.classList.remove("hidden");
      input.value = span.textContent;
    });
  });

  // Guardar cambios del usuario después de autenticación
  ["nombre", "apellido", "edad", "telefono", "correo"].forEach(campo => {
    const button = document.getElementById("guardar-" + campo);
    const input = document.getElementById("input-" + campo);

    button.addEventListener("click", () => {
      console.log("Guardando " + campo); // 👈 prueba
      valorPendiente = input.value;
      campoPendiente = campo;
    // Ocultar paso para nueva contraseña si estaba visible
    document.getElementById("step-new-password").classList.add("hidden");
    
    // Mostrar el paso para la contraseña actual (modal de autenticación)
    document.getElementById("step-current-password").classList.remove("hidden");

    // Mostrar el modal de autenticación
    const changeModal = document.getElementById("change-password-modal");
    changeModal.classList.remove("hidden");
    changeModal.classList.add("show");
          
    });
  });

  // Actualizar campo de usuario después de autenticación
async function actualizarCampoUsuario() {
  const res = await fetch("/api/actualizar-campo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      campo: campoPendiente,
      valor: valorPendiente
    })
  });

  const data = await res.json();
  if (res.ok) {
    document.getElementById(campoPendiente).textContent = valorPendiente;
    document.getElementById("input-" + campoPendiente).classList.add("hidden");
    document.getElementById("guardar-" + campoPendiente).classList.add("hidden");

    // 👇 Cierra el modal si todo salió bien
    const changeModal = document.getElementById("change-password-modal");
    changeModal.classList.remove("show");
    changeModal.classList.add("hidden");

  } else {
    alert(data.error || "No se pudo actualizar.");
  }
}


  // ========== RESET DE PANELES ==========
  function resetSteps() {
    [
      stepCurrentPassword,
      stepNewPassword,
      forgotStep,
      codeStep,
      stepNewPasswordReset
    ].forEach(el => el?.classList.add("hidden"));

    // Limpiar campos
    document.getElementById("current-password").value = "";
    document.getElementById("new-password-auth").value = "";
    forgotEmailInput.value = "";
    codeInput.value = "";
    newPasswordResetInput.value = "";
    changeMsg.textContent = "";
    codeError.textContent = "";
    resetPasswordMsg.textContent = "";

    // Restaurar vista inicial
    stepCurrentPassword.classList.remove("hidden");
    forgotPasswordLink.classList.remove("hidden");
  }
});

async function guardarCambios() {
  const nombre = document.getElementById("nombre").value;
  const apellido = document.getElementById("apellido").value;
  const edad = document.getElementById("edad").value;
  const telefono = document.getElementById("telefono").value;
  const correo = document.getElementById("correo").value;

  try {
    const res = await fetch("/api/configuracion", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nombre,
        apellido,
        edad,
        telefono,
        correo,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      alert("Datos actualizados correctamente");
    } else {
      alert(data.error || "Error al actualizar");
    }
  } catch (err) {
    console.error(err);
    alert("Error al enviar datos");
  }
}
