const Offer = require('../models/Offer');
const User = require('../models/User');
const UserPost = require('../models/UserPost');
const {
  PAYMENT_STATES,
  assertTransition,
} = require('../services/payments/stateMachine');

require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_KEY);

const getCurrentPaymentState = (payment = {}) => {
  if (payment?.state) return payment.state;
  if (payment?.released) return PAYMENT_STATES.TRANSFERRED;
  if (payment?.captured) return PAYMENT_STATES.CAPTURED;
  if (payment?.paymentIntentId) return PAYMENT_STATES.AUTHORIZED;
  return PAYMENT_STATES.PENDING;
};

const pushPaymentAudit = (offer, event, details = {}) => {
  const currentAudit = Array.isArray(offer?.payment?.audit) ? offer.payment.audit : [];
  offer.payment.audit = [
    ...currentAudit,
    {
      event,
      at: new Date(),
      details,
    },
  ];
};

const transitionOfferPaymentState = (offer, nextState, details = {}) => {
  const currentState = getCurrentPaymentState(offer?.payment);
  assertTransition(currentState, nextState);
  offer.payment.state = nextState;
  offer.payment.stateUpdatedAt = new Date();
  if (details && Object.keys(details).length) {
    pushPaymentAudit(offer, `state_${nextState}`, details);
  }
};

const intent = async (req, res) => {
  try {
    const { amount, profitMargin, offerId, email, name, providerAccountId } = req.body;

    const offer = await Offer.findById(offerId);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });

    const commission = Math.floor(amount * profitMargin);
    const totalAmount = amount + commission;

    let customer;
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({ email, name });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'aud',
      customer: customer.id,
      capture_method: 'manual',
      automatic_payment_methods: { enabled: true },
      metadata: {
        offer_id: offerId,
        provider_account_id: providerAccountId,
      },
    });

    offer.payment = {
      state: PAYMENT_STATES.AUTHORIZED,
      paymentIntentId: paymentIntent.id,
      providerStripeAccountId: providerAccountId,
      amount,
      commission,
      captured: false,
      released: false,
      lastError: '',
      stateUpdatedAt: new Date(),
      audit: [
        {
          event: 'intent_created',
          at: new Date(),
          details: {
            paymentIntentId: paymentIntent.id,
            amount: totalAmount,
            currency: 'aud',
          },
        },
      ],
    };

    await offer.save();

    return res.status(200).json({
      message: 'PaymentIntent created successfully',
      paymentIntent: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Stripe intent error:', error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const createStripeAccount = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const account = await stripe.accounts.create({
      type: 'express',
      country: 'AU',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    res.json({ message: 'Account created and linked successfully.', stripeAccountId: account.id });
  } catch (error) {
    console.log('[payment] createStripeAccount failed.');
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

    res.json({ message: 'url.', accountLink });
  } catch (error) {
    console.log('[payment] createStripeAccountLink failed.');
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
            console.log('[payment] deleteStripeUser item delete failed.');
          }
        }
      }

      hasMore = accounts.has_more;
      startingAfter = accounts.data[accounts.data.length - 1]?.id;
    }

    return res.status(200).json({
      message: 'Proceso completado.',
      deletedCount,
    });
  } catch (error) {
    console.error('Error en la eliminacion:', error.message);
    return res.status(500).json({
      message: 'Error eliminando cuentas',
      error: error.message,
    });
  }
};

const checkStripeAccountStatus = async (req, res) => {
  try {
    const { id } = req.params;
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
};

const release = async (req, res) => {
  const { offerId } = req.body;

  try {
    const offer = await Offer.findById(offerId);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });

    if (!offer.payment || offer.payment.released) {
      return res.status(400).json({ message: 'Payment already released or not found' });
    }

    const userPost = await UserPost.findById(offer.post);
    if (!userPost) return res.status(404).json({ message: 'Post not found' });

    if (userPost.owner.toString() !== req.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const currentState = getCurrentPaymentState(offer.payment);
    if (currentState === PAYMENT_STATES.TRANSFERRED) {
      return res.status(400).json({ message: 'Payment already transferred' });
    }

    if (
      currentState !== PAYMENT_STATES.AUTHORIZED &&
      currentState !== PAYMENT_STATES.CAPTURED
    ) {
      return res.status(409).json({
        message: `Invalid payment state for release: ${currentState}`,
      });
    }

    if (currentState === PAYMENT_STATES.AUTHORIZED) {
      await stripe.paymentIntents.capture(offer.payment.paymentIntentId);
      transitionOfferPaymentState(offer, PAYMENT_STATES.CAPTURED, {
        paymentIntentId: offer.payment.paymentIntentId,
      });
      offer.payment.captured = true;
      offer.payment.capturedAt = new Date();
    }

    transitionOfferPaymentState(offer, PAYMENT_STATES.TRANSFER_PENDING, {
      providerStripeAccountId: offer.payment.providerStripeAccountId,
    });

    const transfer = await stripe.transfers.create({
      amount: offer.payment.amount,
      currency: 'aud',
      destination: offer.payment.providerStripeAccountId,
      metadata: {
        payment_intent: offer.payment.paymentIntentId,
        offer_id: offer._id.toString(),
      },
    });

    offer.payment.released = true;
    offer.payment.releasedAt = new Date();
    offer.payment.transferId = transfer.id;
    offer.payment.lastError = '';
    transitionOfferPaymentState(offer, PAYMENT_STATES.TRANSFERRED, {
      transferId: transfer.id,
    });
    await offer.save();

    return res.status(200).json({
      message: 'Payment captured and released to provider',
      transferId: transfer.id,
    });
  } catch (error) {
    console.error('Error releasing payment:', error);

    if (offerId) {
      try {
        const failedOffer = await Offer.findById(offerId);
        if (failedOffer?.payment) {
          const failedState = getCurrentPaymentState(failedOffer.payment);
          if (
            failedState !== PAYMENT_STATES.TRANSFERRED &&
            failedState !== PAYMENT_STATES.FAILED
          ) {
            try {
              transitionOfferPaymentState(failedOffer, PAYMENT_STATES.FAILED, {
                reason: error?.message || 'release_failed',
              });
            } catch (_) {
              // If transition assertion fails, still persist error details below.
            }
          }
          failedOffer.payment.lastError = error?.message || 'release_failed';
          pushPaymentAudit(failedOffer, 'release_error', {
            reason: error?.message || 'release_failed',
          });
          await failedOffer.save();
        }
      } catch (persistErr) {
        console.error('Error persisting failed payment state:', persistErr?.message);
      }
    }

    return res.status(error.statusCode || error.code || 500).json({ message: error.message });
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
  release,
};
