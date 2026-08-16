export const PRACTICEPILOT_LEGAL = {
  saasAgreementVersion: "1.0",
  privacyNoticeVersion: "1.0",
  dpaVersion: "1.0",

  billingCutoffDay: 25,
  billingDay: 26,
  paymentTermsDays: 7,

  documents: {
    saasAgreement: "/legal/saas-subscription-agreement",
    privacyNotice: "/legal/privacy-notice",
    dpa: "/legal/data-processing-agreement",
  },

  acceptanceText:
    "I confirm that I am authorised to enter into this agreement on behalf of the practice and that I have read and accept the PracticePilot SaaS Subscription Agreement, Privacy Notice and Data Processing and Operator Agreement.",

  flex: {
    planName: "AFS Flex",
    monthlyPrice: 199,
    includedAfsPerBillingCycle: 1,
    additionalAfsPrice: 295,
    proratedOnActivation: false,
    includedAfsRollsOver: false,
  },

  unlimited: {
    planName: "AFS Unlimited",
    monthlyPricePerLicence: 499,
    proratedOnActivation: true,
  },
} as const;