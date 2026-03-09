const PAYMENT_STATES = Object.freeze({
  PENDING: "pending",
  AUTHORIZED: "authorized",
  CAPTURED: "captured",
  TRANSFER_PENDING: "transfer_pending",
  TRANSFERRED: "transferred",
  FAILED: "failed",
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [PAYMENT_STATES.PENDING]: [PAYMENT_STATES.AUTHORIZED, PAYMENT_STATES.FAILED],
  [PAYMENT_STATES.AUTHORIZED]: [PAYMENT_STATES.CAPTURED, PAYMENT_STATES.FAILED],
  [PAYMENT_STATES.CAPTURED]: [PAYMENT_STATES.TRANSFER_PENDING, PAYMENT_STATES.FAILED],
  [PAYMENT_STATES.TRANSFER_PENDING]: [PAYMENT_STATES.TRANSFERRED, PAYMENT_STATES.FAILED],
  [PAYMENT_STATES.TRANSFERRED]: [],
  [PAYMENT_STATES.FAILED]: [],
});

const canTransition = (fromState, toState) => {
  if (!toState || !Object.values(PAYMENT_STATES).includes(toState)) return false;
  if (fromState === toState) return true;
  const allowed = ALLOWED_TRANSITIONS[fromState] || [];
  return allowed.includes(toState);
};

const assertTransition = (fromState, toState) => {
  if (!canTransition(fromState, toState)) {
    const err = new Error(`Invalid payment state transition: ${fromState} -> ${toState}`);
    err.code = 409;
    throw err;
  }
};

module.exports = {
  PAYMENT_STATES,
  canTransition,
  assertTransition,
};
