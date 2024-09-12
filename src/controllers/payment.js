require('dotenv').config();
const stripe = require("stripe")( process.env.STRIPE_KEY)

const intent = async(req, res) => {
    try {
        console.log(req.body.amount)
        const paymentIntent = await stripe.paymentIntents.create({
            amount: req.body.amount, // Integer, usd -> pennies, eur -> cents
            currency: 'aud',
            automatic_payment_methods: {
              enabled: true,
            },
          });
          // Return the secret
          res.json({ paymentIntent: paymentIntent.client_secret });
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}

module.exports = {
 intent
}

