const Offer = require('../models/Offer');
const User = require('../models/User');
const UserPost = require('../models/UserPost');

require('dotenv').config();
const stripe = require("stripe")( process.env.STRIPE_KEY)

const intent = async (req, res) => {
  try {
    const { amount, offerId, email, name, providerAccountId } = req.body;

    const offer = await Offer.findById(offerId);
    if (!offer) return res.status(404).json({ message: "Offer not found" });

    let customer;
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email,
        name,
        description: 'Client created for payment',
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "aud",
      customer: customer.id,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        offer_id: offerId,
        provider_account_id: providerAccountId,
      }
    });

    offer.payment = {
      paymentIntentId: paymentIntent.id,
      providerStripeAccountId: providerAccountId,
      amount: amount,
      released: false,
    };
    await offer.save();

    res.status(200).json({ message: 'paymentIntent successful.', paymentIntent: paymentIntent.client_secret, });

  } catch (error) {
    console.error("Stripe error:", error);
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ message: 'Invalid request: ' + error.message });
    }
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

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

    res.json({ message: "url.", accountLink });
    
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: error.message });
  }
};

const returnUrl = async (req, res) => {
  const deepLink = 'cacapp://stripe-return';
  res.redirect(deepLink);
};

const refreshUrl = async (req, res) => {
  const deepLink = 'cacapp://stripe-refresh';
  res.redirect(deepLink);
};

const deleteStripeUser = async (req, res) => {
  const { email: targetEmail } = req.body;
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
          try {
            await stripe.accounts.del(account.id);
            deletedCount++;
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

const checkStripeAccountStatus = async (req,res) => {
  try {
    const { id } = req.params
    const user = await User.findById(id);
   
    const accountId = user?.transportInfo?.stripeAccount?.accountId;

    if (!accountId) {
      return res.status(400).json({ message: 'Stripe accountId not found in user data.' });
    }

    try {
      const account = await stripe.accounts.retrieve(accountId);
      return res.status(200).json({
        message: 'Stripe account exists.',
        accountId: account.id,
        detailsSubmitted: account.details_submitted,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      });
    } catch (stripeErr) {
      if (stripeErr.statusCode === 404) {
        return res.status(404).json({ message: 'Stripe account not found.' });
      }
      throw stripeErr;
    }
  } catch (err) {
    console.error('Error verifying Stripe account:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

const release = async (req, res) => {
  try {
    const { offerId } = req.body;

    const offer = await Offer.findById(offerId);
    if (!offer) return res.status(404).json({ message: "Offer not found" });

    const userPost = await UserPost.findById(offer.post);
    if (!userPost) return res.status(404).json({ message: "Post not found" });

    if (userPost.owner.toString() !== req.userId) {
      return res.status(403).json({ message: "Unauthorized: you are not the owner of this post" });
    }

    if (!offer.payment || offer.payment.released) {
      return res.status(400).json({ message: "Payment already released or not found" });
    }

    const transfer = await stripe.transfers.create({
      amount: offer.payment.amount,
      currency: "aud",
      destination: offer.payment.providerStripeAccountId,
      metadata: {
        payment_intent: offer.payment.paymentIntentId,
        offer_id: offer._id.toString(),
      },
    });

    offer.payment.released = true;
    offer.payment.transferId = transfer.id;
    await offer.save();

    res.status(200).json({ message: 'Payment released to provider', transferId: transfer.id });

  } catch (error) {
    console.error("Error releasing payment:", error.message);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

module.exports = {
  intent,
  createStripeAccount,
  createStripeAccountLink,
  returnUrl,
  refreshUrl,
  deleteStripeUser,
  checkStripeAccountStatus,
  release
}
