export interface PricingParam {
  key: string;
  label: string;
  description: string;
  type: 'number' | 'boolean' | 'string';
  default: number | boolean | string;
  value: number | boolean | string;
  source: 'db' | 'env' | 'default';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface PricingConfigView {
  params: PricingParam[];
}

export interface StripeConfigView {
  secretKeyMasked: string;
  secretKeyConfigured: boolean;
  secretKeyFromEnv: boolean;
  webhookSecretMasked: string;
  webhookSecretConfigured: boolean;
  webhookSecretFromEnv: boolean;
  successUrl: string;
  cancelUrl: string;
  currency: string;
  enabled: boolean;
}

export interface CreditPackage {
  id: string;
  code: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
  stripePriceId: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface PlanEntitlement {
  id: string;
  planCode: string;
  name: string;
  monthlyPriceCents: number;
  monthlyCredits: number;
  creditPurchaseDiscount: number;
  subscriptionPurchaseDiscount: number;
  maxConcurrentJobs: number;
  queuePriority: number;
  maxResolution: string;
  watermarkRequired: boolean;
  allowSeedance: boolean;
  allowUltron: boolean;
  videoPriceCoefficient: number;
  allowMultiCharacter: boolean;
  allowCommercialUse: boolean;
  stripePriceId: string | null;
  sortOrder: number;
  isActive: boolean;
}
