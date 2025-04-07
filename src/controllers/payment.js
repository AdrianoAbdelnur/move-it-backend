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

      user.transportInfo = {
        ...user.transportInfo, 
        stripeAccount: {
          ...user.transportInfo?.stripeAccount,
          accountId: account.id,
        }
      };
      
      await user.save();

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

    res.json({ message: "url.", accountLink });
    
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: error.message });
  }
};

const returnUrl = async (req, res) => {
  console.log("returnUrl", req)
  const deepLink = 'cacapp://stripe-return';
  res.redirect(deepLink);
};

const refreshUrl = async (req, res) => {
  console.log("refreshUrl", req)
  const deepLink = 'cacapp://stripe-refresh';
  res.redirect(deepLink);
};

const deleteStripeUser = async (req, res) => {
  const { email: targetEmail } = req.body;
  console.log("targetEmail",targetEmail)
  let hasMore = true;
  let startingAfter = null;
  let deletedCount = 0;

  try {
    while (hasMore) {
      const accounts = await stripe.accounts.list({
        limit: 100,
        ...(startingAfter && { starting_after: startingAfter }),
      });

      for (const account of accounts.data) {
        if (account.email === targetEmail) {
          console.log(`Eliminando cuenta: ${account.id} (${account.email})`);
          try {
            await stripe.accounts.del(account.id);
            deletedCount++;
            console.log(`✅ Eliminada: ${account.id}`);
          } catch (err) {
            console.log(`❌ Error al eliminar ${account.id}:`, err.message);
          }
        }
      }

      hasMore = accounts.has_more;
      startingAfter = accounts.data[accounts.data.length - 1]?.id;
    }

    return res.status(200).json({
      message: `Proceso completado.`,
      deletedCount,
    });

  } catch (error) {
    console.error('Error en la eliminación:', error.message);
    return res.status(500).json({
      message: "Error eliminando cuentas",
      error: error.message
    });
  }
};

module.exports = {
 intent,
 createStripeAccount,
 createStripeAccountLink,
 returnUrl,
 refreshUrl,
 deleteStripeUser

}

