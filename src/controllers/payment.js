require('dotenv').config();
const stripe = require("stripe")( process.env.STRIPE_KEY)

const intent = async(req, res) => {
    try {
        let customer;
        const existingCustomers = await stripe.customers.list({
          email: req.body.email,
          limit: 1,
        });
    
        if (existingCustomers.data.length > 0) {
          customer = existingCustomers.data[0];
        } else {
          customer = await stripe.customers.create({
            email: req.body.email,
            name: req.body.name,
            description: 'Nuevo cliente para pago',
          });
        }




        const paymentIntent = await stripe.paymentIntents.create({
            amount: req.body.amount, 
            currency: 'aud',
            customer: customer.id,
            automatic_payment_methods: {
              enabled: true,
            },
          });
          res.json({ paymentIntent: paymentIntent.client_secret, customer });
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}

module.exports = {
 intent
}

