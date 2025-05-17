// emailSender.js
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
        service: 'Gmail',
        auth: {
          user: process.env.EMAIL_ORIGEN,
          pass: process.env.EMAIL_PASS,
        },
      }),
    };
  }
};

const enviarCorreo = async ({ to, subject, html }) => {
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
};

module.exports = enviarCorreo;
