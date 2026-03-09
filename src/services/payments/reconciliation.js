const Offer = require("../../models/Offer");
const stripe = require("stripe")(process.env.STRIPE_KEY);
const { PAYMENT_STATES } = require("./stateMachine");

const ACTIVE_PAYMENT_STATES = [
  PAYMENT_STATES.AUTHORIZED,
  PAYMENT_STATES.CAPTURED,
  PAYMENT_STATES.TRANSFER_PENDING,
];

const PAYMENT_STATE_ORDER = [
  PAYMENT_STATES.PENDING,
  PAYMENT_STATES.AUTHORIZED,
  PAYMENT_STATES.CAPTURED,
  PAYMENT_STATES.TRANSFER_PENDING,
  PAYMENT_STATES.TRANSFERRED,
];

const parsePositiveInt = (rawValue, fallback) => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const shouldRunScheduler = () =>
  String(process.env.STRIPE_RECONCILIATION_ENABLED || "true").toLowerCase() !== "false";

const reconcileIntervalMs = () =>
  parsePositiveInt(process.env.STRIPE_RECONCILIATION_INTERVAL_MS, 10 * 60 * 1000);

const reconcileBatchSize = () =>
  parsePositiveInt(process.env.STRIPE_RECONCILIATION_BATCH_SIZE, 50);

const getCurrentPaymentState = (payment = {}) => {
  if (payment?.state) return payment.state;
  if (payment?.released) return PAYMENT_STATES.TRANSFERRED;
  if (payment?.captured) return PAYMENT_STATES.CAPTURED;
  if (payment?.paymentIntentId) return PAYMENT_STATES.AUTHORIZED;
  return PAYMENT_STATES.PENDING;
};

const appendAudit = (offer, event, details = {}) => {
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

const promoteState = (offer, targetState, details = {}) => {
  const current = getCurrentPaymentState(offer.payment);
  if (current === targetState) return false;

  if (targetState === PAYMENT_STATES.FAILED) {
    if (current !== PAYMENT_STATES.TRANSFERRED) {
      offer.payment.state = PAYMENT_STATES.FAILED;
      offer.payment.stateUpdatedAt = new Date();
      appendAudit(offer, "state_failed_reconciled", details);
      return true;
    }
    return false;
  }

  const currentIndex = PAYMENT_STATE_ORDER.indexOf(current);
  const targetIndex = PAYMENT_STATE_ORDER.indexOf(targetState);
  if (currentIndex === -1 || targetIndex === -1 || targetIndex <= currentIndex) return false;

  offer.payment.state = targetState;
  offer.payment.stateUpdatedAt = new Date();
  appendAudit(offer, `state_${targetState}_reconciled`, details);
  return true;
};

const getTargetStateFromStripe = ({ paymentIntent, transfer, offer }) => {
  if (transfer) {
    const transferWasReversed =
      transfer.reversed === true || Number(transfer.amount_reversed || 0) > 0;
    if (transferWasReversed) return PAYMENT_STATES.FAILED;
    return PAYMENT_STATES.TRANSFERRED;
  }

  if (!paymentIntent) return null;

  if (
    paymentIntent.status === "canceled" ||
    paymentIntent.status === "requires_payment_method"
  ) {
    return PAYMENT_STATES.FAILED;
  }

  if (paymentIntent.status === "requires_capture") {
    return PAYMENT_STATES.AUTHORIZED;
  }

  if (paymentIntent.status === "succeeded") {
    if (offer?.payment?.released) return PAYMENT_STATES.TRANSFERRED;
    return PAYMENT_STATES.CAPTURED;
  }

  return null;
};

const buildReconcileFilter = () => ({
  "payment.paymentIntentId": { $exists: true, $ne: "" },
  $or: [
    { "payment.state": { $in: ACTIVE_PAYMENT_STATES } },
    {
      "payment.state": { $exists: false },
      "payment.released": { $ne: true },
    },
  ],
});

let isRunning = false;

const reconcilePaymentsOnce = async ({ limit = reconcileBatchSize() } = {}) => {
  if (isRunning) {
    return { skipped: true, reason: "already_running" };
  }
  isRunning = true;

  try {
    const candidates = await Offer.find(buildReconcileFilter())
      .sort({ "payment.stateUpdatedAt": 1, _id: 1 })
      .limit(limit);

    let checked = 0;
    let updated = 0;
    let failed = 0;

    for (const offer of candidates) {
      checked += 1;
      try {
        const paymentIntentId = offer?.payment?.paymentIntentId;
        if (!paymentIntentId) continue;

        const [paymentIntent, transfer] = await Promise.all([
          stripe.paymentIntents.retrieve(paymentIntentId),
          offer?.payment?.transferId
            ? stripe.transfers.retrieve(offer.payment.transferId)
            : Promise.resolve(null),
        ]);

        const targetState = getTargetStateFromStripe({ paymentIntent, transfer, offer });
        if (!targetState) continue;

        const changed = promoteState(offer, targetState, {
          source: "reconciliation_job",
          paymentIntentId,
          transferId: transfer?.id || offer?.payment?.transferId || null,
          paymentIntentStatus: paymentIntent?.status || null,
        });

        if (changed) {
          if (targetState === PAYMENT_STATES.CAPTURED) {
            offer.payment.captured = true;
            offer.payment.capturedAt = offer.payment.capturedAt || new Date();
            offer.payment.lastError = "";
          }
          if (targetState === PAYMENT_STATES.TRANSFERRED) {
            offer.payment.released = true;
            offer.payment.releasedAt = offer.payment.releasedAt || new Date();
            if (transfer?.id) {
              offer.payment.transferId = transfer.id;
            }
            offer.payment.lastError = "";
          }
          if (targetState === PAYMENT_STATES.FAILED) {
            offer.payment.lastError =
              paymentIntent?.last_payment_error?.message ||
              "reconciliation_detected_failed_state";
          }

          await offer.save();
          updated += 1;
        }
      } catch (error) {
        failed += 1;
        if (process.env.NODE_ENV !== "production") {
          console.warn("[payments:reconcile] item failed:", error?.message);
        }
      }
    }

    return { skipped: false, checked, updated, failed };
  } finally {
    isRunning = false;
  }
};

const startPaymentReconciliationScheduler = () => {
  if (!shouldRunScheduler()) {
    return null;
  }

  const intervalMs = reconcileIntervalMs();
  const batchSize = reconcileBatchSize();

  // Warm up once shortly after startup.
  setTimeout(() => {
    reconcilePaymentsOnce({ limit: batchSize }).catch((error) => {
      console.error("[payments:reconcile] warmup failed:", error?.message);
    });
  }, 15 * 1000);

  const timer = setInterval(() => {
    reconcilePaymentsOnce({ limit: batchSize })
      .then((result) => {
        if (process.env.NODE_ENV !== "production") {
          console.log("[payments:reconcile]", result);
        }
      })
      .catch((error) => {
        console.error("[payments:reconcile] run failed:", error?.message);
      });
  }, intervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  return timer;
};

module.exports = {
  reconcilePaymentsOnce,
  startPaymentReconciliationScheduler,
};
