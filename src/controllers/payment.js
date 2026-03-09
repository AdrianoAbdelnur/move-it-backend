const Offer = require('../models/Offer');
const User = require('../models/User');
const UserPost = require('../models/UserPost');
const StripeWebhookEvent = require('../models/StripeWebhookEvent');
const crypto = require('crypto');
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

const PAYMENT_STATE_ORDER = [
  PAYMENT_STATES.PENDING,
  PAYMENT_STATES.AUTHORIZED,
  PAYMENT_STATES.CAPTURED,
  PAYMENT_STATES.TRANSFER_PENDING,
  PAYMENT_STATES.TRANSFERRED,
];

const promoteOfferState = (offer, targetState, details = {}) => {
  const current = getCurrentPaymentState(offer.payment);
  if (current === targetState) return;

  if (targetState === PAYMENT_STATES.FAILED) {
    if (current !== PAYMENT_STATES.TRANSFERRED) {
      try {
        transitionOfferPaymentState(offer, PAYMENT_STATES.FAILED, details);
      } catch (_) {
        offer.payment.state = PAYMENT_STATES.FAILED;
        offer.payment.stateUpdatedAt = new Date();
        pushPaymentAudit(offer, "state_failed_reconciled", details);
      }
    }
    return;
  }

  const currentIndex = PAYMENT_STATE_ORDER.indexOf(current);
  const targetIndex = PAYMENT_STATE_ORDER.indexOf(targetState);
  if (currentIndex === -1 || targetIndex === -1 || targetIndex <= currentIndex) return;

  for (let idx = currentIndex + 1; idx <= targetIndex; idx += 1) {
    const next = PAYMENT_STATE_ORDER[idx];
    try {
      transitionOfferPaymentState(offer, next, idx === targetIndex ? details : {});
    } catch (_) {
      offer.payment.state = next;
      offer.payment.stateUpdatedAt = new Date();
      if (idx === targetIndex) {
        pushPaymentAudit(offer, `state_${next}_reconciled`, details);
      }
    }
  }
};

const findOfferForStripeObject = async (object = {}) => {
  const offerIdFromMeta = object?.metadata?.offer_id;
  if (offerIdFromMeta) {
    const byMeta = await Offer.findById(offerIdFromMeta);
    if (byMeta) return byMeta;
  }

  if (object?.payment_intent) {
    const byPaymentIntent = await Offer.findOne({
      "payment.paymentIntentId": object.payment_intent,
    });
    if (byPaymentIntent) return byPaymentIntent;
  }

  if (object?.id && String(object.object || "").toLowerCase() === "payment_intent") {
    const byIntentId = await Offer.findOne({
      "payment.paymentIntentId": object.id,
    });
    if (byIntentId) return byIntentId;
  }

  if (object?.id && String(object.object || "").toLowerCase() === "transfer") {
    const byTransferId = await Offer.findOne({
      "payment.transferId": object.id,
    });
    if (byTransferId) return byTransferId;
  }

  return null;
};

const stripeWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return res.status(500).json({ message: "Missing STRIPE_WEBHOOK_SECRET." });
  }
  if (!signature) {
    return res.status(400).json({ message: "Missing stripe-signature header." });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    return res.status(400).json({ message: `Invalid webhook signature: ${error.message}` });
  }

  try {
    const claim = await StripeWebhookEvent.updateOne(
      { stripeEventId: event.id },
      {
        $setOnInsert: {
          stripeEventId: event.id,
          eventType: event.type,
          status: "processing",
        },
      },
      { upsert: true },
    );

    if (!claim?.upsertedCount) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    const object = event?.data?.object || {};
    const offer = await findOfferForStripeObject(object);

    if (offer) {
      const eventType = event.type;

      if (eventType === "payment_intent.succeeded" || eventType === "charge.captured") {
        promoteOfferState(offer, PAYMENT_STATES.CAPTURED, {
          eventId: event.id,
          eventType,
        });
        offer.payment.captured = true;
        offer.payment.capturedAt = offer.payment.capturedAt || new Date();
        offer.payment.lastError = "";
      } else if (eventType === "transfer.created") {
        promoteOfferState(offer, PAYMENT_STATES.TRANSFERRED, {
          eventId: event.id,
          eventType,
          transferId: object?.id,
        });
        if (object?.id) offer.payment.transferId = object.id;
        offer.payment.released = true;
        offer.payment.releasedAt = offer.payment.releasedAt || new Date();
        offer.payment.lastError = "";
      } else if (
        eventType === "payment_intent.payment_failed" ||
        eventType === "payment_intent.canceled" ||
        eventType === "transfer.failed" ||
        eventType === "transfer.reversed"
      ) {
        const reason =
          object?.last_payment_error?.message ||
          object?.failure_message ||
          object?.failure_reason ||
          "stripe_webhook_failure";
        promoteOfferState(offer, PAYMENT_STATES.FAILED, {
          eventId: event.id,
          eventType,
          reason,
        });
        offer.payment.lastError = reason;
      }

      pushPaymentAudit(offer, "webhook_received", {
        eventId: event.id,
        eventType: event.type,
      });
      await offer.save();
    }

    await StripeWebhookEvent.updateOne(
      { stripeEventId: event.id },
      {
        $set: {
          status: "processed",
          processedAt: new Date(),
          offer: offer?._id || null,
        },
      },
    );

    return res.status(200).json({ received: true });
  } catch (error) {
    await StripeWebhookEvent.updateOne(
      { stripeEventId: event.id },
      {
        $set: {
          status: "failed",
          error: error?.message || "webhook_processing_failed",
          processedAt: new Date(),
        },
      },
    ).catch(() => null);

    return res.status(500).json({ message: error?.message || "Webhook processing failed." });
  }
};

const buildIdempotencyKey = (action, rawParts = []) => {
  const normalized = rawParts
    .map((value) => String(value ?? '').trim())
    .join('|');
  const digest = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
  return `cac:${action}:${digest}`;
};

const intent = async (req, res) => {
  try {
    const { amount, profitMargin, offerId, email, name, providerAccountId } = req.body;

    const offer = await Offer.findById(offerId);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });

    const relatedPost = await UserPost.findById(offer.post).select("owner").lean();
    if (!relatedPost?.owner || String(relatedPost.owner) !== String(req.userId)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const commission = Math.floor(amount * profitMargin);
    const totalAmount = amount + commission;
    const intentKey = buildIdempotencyKey('intent', [
      offerId,
      amount,
      commission,
      providerAccountId,
      email,
    ]);

    let customer;
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({ email, name });
    }

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmount,
        currency: 'aud',
        customer: customer.id,
        capture_method: 'manual',
        automatic_payment_methods: { enabled: true },
        metadata: {
          offer_id: offerId,
          provider_account_id: providerAccountId,
        },
      },
      { idempotencyKey: intentKey },
    );

    offer.payment = {
      state: PAYMENT_STATES.AUTHORIZED,
      paymentIntentId: paymentIntent.id,
      providerStripeAccountId: providerAccountId,
      amount,
      commission,
      captured: false,
      released: false,
      idempotency: {
        intentKey,
      },
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
    const user = await User.findById(req.userId).select("email role");
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (user.role !== "transport" && req.userRole !== "admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }
    const email = user.email;

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
    const user = await User.findById(req.userId).select("email");
    if (!user) return res.status(404).json({ message: "User not found." });

    const account = await stripe.accounts.retrieve(accountId);
    const accountEmail = String(account?.email || "").toLowerCase();
    const userEmail = String(user.email || "").toLowerCase();
    if (!accountEmail || accountEmail !== userEmail) {
      return res.status(403).json({ message: "Unauthorized" });
    }

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
    if (String(req.userId) !== String(id) && String(req.userRole) !== "admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }
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

    const captureKey =
      offer?.payment?.idempotency?.captureKey ||
      buildIdempotencyKey('capture', [offer._id, offer.payment.paymentIntentId]);
    const transferKey =
      offer?.payment?.idempotency?.transferKey ||
      buildIdempotencyKey('transfer', [offer._id, offer.payment.paymentIntentId]);

    offer.payment.idempotency = {
      ...(offer.payment.idempotency || {}),
      captureKey,
      transferKey,
    };

    if (currentState === PAYMENT_STATES.AUTHORIZED) {
      await stripe.paymentIntents.capture(
        offer.payment.paymentIntentId,
        {},
        { idempotencyKey: captureKey },
      );
      transitionOfferPaymentState(offer, PAYMENT_STATES.CAPTURED, {
        paymentIntentId: offer.payment.paymentIntentId,
        captureKey,
      });
      offer.payment.captured = true;
      offer.payment.capturedAt = new Date();
    }

    transitionOfferPaymentState(offer, PAYMENT_STATES.TRANSFER_PENDING, {
      providerStripeAccountId: offer.payment.providerStripeAccountId,
    });

    const transfer = await stripe.transfers.create(
      {
        amount: offer.payment.amount,
        currency: 'aud',
        destination: offer.payment.providerStripeAccountId,
        metadata: {
          payment_intent: offer.payment.paymentIntentId,
          offer_id: offer._id.toString(),
        },
      },
      { idempotencyKey: transferKey },
    );

    offer.payment.released = true;
    offer.payment.releasedAt = new Date();
    offer.payment.transferId = transfer.id;
    offer.payment.lastError = '';
    transitionOfferPaymentState(offer, PAYMENT_STATES.TRANSFERRED, {
      transferId: transfer.id,
      transferKey,
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
  stripeWebhook,
};
