const nodemailer = require("nodemailer");
require('dotenv').config();

const createTransport = () => {
    const transport = nodemailer.createTransport({
        host:'smtp.gmail.com',
        port:465,
        secure:true,
        auth:{
            user:'adrianoabdelnur08@gmail.com',
            pass:process.env.GMAIL_PASS,
        },
        tls: {
            rejectUnauthorized: false // Desactiva la verificación de certificados autofirmados
        }
    });

    return transport;
}

const sendMail = async (user) => {
    try {
        const transporter = createTransport();
        const date = new Date(user.verificationInfo.expirationTime);

        const readableDate = date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          });

        const info = await transporter.sendMail({
            from: 'adrianoabdelnur08@gmail.com',
            to: `${user.email}`,
            subject: `Hello ${user.given_name} Welcome to Call a Car's community`,
            html: `<p>Your verification code is: <strong>${user.verificationInfo.verificationCode}</strong> and it will exprire on ${readableDate}`
        });
    } catch (error) {
        console.error('Error al enviar el correo:', error.message);
    }
}



exports.sendMail = (user) => sendMail(user);
