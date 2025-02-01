const nodemailer = require("nodemailer");
require('dotenv').config();

const createTransport = () => {
    const transport = nodemailer.createTransport({
        host:'smtp.gmail.com',
        port:465,
        secure:true,
        auth:{
            user:'callacartransportation@gmail.com',
            pass:process.env.GMAIL_PASS,
        },
        tls: {
            rejectUnauthorized: false 
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
            from: 'callacartransportation@gmail.com',
            to: `${user.email}`,
            subject: `Hi ${user.given_name}, use this code to verify your account`,
            html: `<p>Your verification code is: <strong>${user.verificationInfo.verificationCode}</strong> and it will exprire on ${readableDate}`
        });
    } catch (error) {
        console.error('Error al enviar el correo:', error.message);
    }
}



exports.sendMail = (user) => sendMail(user);
