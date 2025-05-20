const nodemailer = require("nodemailer");

const isDev = process.env.NODE_ENV !== 'production';

const crearTransporter = async () => {
  if (isDev) {
    const testAccount = await nodemailer.createTestAccount();
    return {
      transporter: nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      }),
      testAccount
    };
  } else {
    return {
      transporter: nodemailer.createTransport({
        host: "smtp.sendgrid.net",
        port: 587,
        secure: false,
        auth: {
          user: "apikey", // ¡Literalmente esto!
          pass: process.env.SENDGRID_API_KEY,
        },
      }),
    };
  }
};

const enviarCorreo = async ({ to, subject, html }) => {
  try {
    const { transporter, testAccount } = await crearTransporter();
    const info = await transporter.sendMail({
      from: `"Mi App" <${process.env.EMAIL_ORIGEN}>`,
      to,
      subject,
      html,
    });

    if (isDev) {
      console.log("📧 Correo simulado: " + nodemailer.getTestMessageUrl(info));
    } else {
      console.log("✅ Correo enviado: " + info.messageId);
    }
  } catch (error) {
    console.error("❌ Error al enviar correo:", error);
  }
};

module.exports = enviarCorreo;
