/* const nodemailer = require("nodemailer"); */
require('dotenv').config();

const createTransport = () => {
    const transport = nodemailer.createTransport({
        host:'smtp.gmail.com',
        port:465,
        secure:true,
        auth:{
            user:'tommysaurio007@gmail.com',
            pass:process.env.GMAIL_PASS,
        }
    });

    return transport;
}

const sendMail = async (user) => {
    const transporter = await createTransport();
    const info = await transporter.sendMail({
        from:'tommysaurio007@gmail.com',
        to:`${user.email}`,
        subject: `Hello ${user.username} Welcome to Mi Barrio Ciudadela's community`,
        html: '<h1>Hi there your registration has been succesfully received.</h1><br/><h5>We have sent you a copy of our menu, hope we see you soon to taste our burgers!<h5/><br/><a href>',
        attachments: [
            {   
                filename: 'carta.pdf',
                path: 'https://github.com/thomas64mafut/g2-frontend/raw/main/src/assets/Carta%20Barrio.pdf'
            },
        ]
    })

    return
}

exports.sendMail = (user) => sendMail(user);
