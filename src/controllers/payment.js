const User = require('../models/User');

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
            description: 'new client to pay',
          });
        }

        const amount = req.body.amount;

        const feePercentage = req.body.feePercentage || 20; 
        const feeAmount = Math.round(amount * (feePercentage / 100)); 

        const paymentIntent = await stripe.paymentIntents.create({
            amount: req.body.amount, 
            currency: 'aud',
            customer: customer.id,
            automatic_payment_methods: {
              enabled: true,
            },
            /* application_fee_amount: feeAmount, 
            transfer_data: {
                destination: req.body.accountId,
            }, */
          });
          res.json({ paymentIntent: paymentIntent.client_secret, customer });
    } catch (error) {
      if (error.type === 'StripeInvalidRequestError') {
        return res.status(400).json({ message: 'Invalid request: ' + error.message });
      }
      res.status(error.code || 500).json({ message: error.message });
    }
}


const createStripeAccount = async (req, res) => {
  
  try {
    const {email} = req.body
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

      const account = await stripe.accounts.create({
          type: 'express', 
          country: 'AU',
          email: email,
          capabilities: {
              card_payments: { requested: true },
              transfers: { requested: true }
          }
      });

      res.json({ message: "Account created and linked successfully.", stripeAccountId: account.id });
  } catch (error) {
    console.log(error)
    console.log(error)
      res.status(500).json({ message: error.message });
  }
};


const createStripeAccountLink = async (req, res) => {
  const { accountId } = req.body;

  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: 'https://move-it-backend-3.onrender.com/api/payment/refreshUrl',  
      return_url: 'https://move-it-backend-3.onrender.com/api/payment/returnUrl',    
      type: 'account_onboarding', 
    });

    
    console.log(accountLink)
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: error.message });
  }
};

const returnUrl = async (req, res) => {
  console.log("returnUrl")
};

const refreshUrl = async (req, res) => {
  console.log("refreshUrl")
};

module.exports = {
 intent,
 createStripeAccount,
 createStripeAccountLink,
 returnUrl,
 refreshUrl
}

