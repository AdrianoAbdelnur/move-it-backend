const TERMS_VERSION = process.env.TERMS_VERSION || "v1";

const getTermsStatus = (user) => {
  const accepted = user?.consents?.terms?.accepted === true;
  const userTermsVersion = user?.consents?.terms?.version || null;
  const mustAcceptTerms = !accepted || userTermsVersion !== TERMS_VERSION;

  return {
    mustAcceptTerms,
    currentTermsVersion: TERMS_VERSION,
    userTermsVersion,
  };
};

module.exports = { getTermsStatus, TERMS_VERSION };
