// App-level configuration sourced from Vite env vars, with sensible fallbacks
// so the app works out of the box in dev.

// PayPal donation link (header CTA + donate popup). Override via VITE_PAYPAL_URL.
export const PAYPAL_URL = import.meta.env.VITE_PAYPAL_URL || 'https://paypal.me/ColeSimmons202';
