// Commercial locales (Founder decision 2026-10-09): pt-BR first, then pt-PT, en, es, fr.
export const COMMERCE_LOCALES = ['pt-BR', 'pt-PT', 'en', 'es', 'fr'] as const;
export type CommerceLocale = typeof COMMERCE_LOCALES[number];
export const CURRENCIES = ['BRL', 'EUR', 'USD'] as const;
export const DEFAULT_LOCALE: CommerceLocale = 'pt-BR';
const FALLBACK: Record<CommerceLocale, CommerceLocale[]> = { 'pt-BR': ['pt-BR', 'pt-PT', 'en'], 'pt-PT': ['pt-PT', 'pt-BR', 'en'], en: ['en'], es: ['es', 'en'], fr: ['fr', 'en'] };
export const asLocale = (v: unknown): CommerceLocale => (COMMERCE_LOCALES as readonly string[]).includes(String(v)) ? v as CommerceLocale : DEFAULT_LOCALE;
// Pick the best translation row for a locale; the API reports which locale was actually served.
export function pick<T extends { locale: string }>(rows: T[], locale: CommerceLocale): T | undefined {
 for (const l of FALLBACK[locale]) { const r = rows.find(x => x.locale === l); if (r) return r; }
 return rows[0];
}

// Consent wording is versioned and stored as evidence with every consent row.
export const CONSENT_VERSION = 'v1-2026-10';
export const CONSENT_TEXT: Record<'contact_sales' | 'trial', Record<CommerceLocale, string>> = {
 contact_sales: {
  'pt-BR': 'Autorizo a AtlasHub a me contatar sobre este pedido e a tratar estes dados para esse fim. Posso retirar o consentimento a qualquer momento.',
  'pt-PT': 'Autorizo a AtlasHub a contactar-me sobre este pedido e a tratar estes dados para esse fim. Posso retirar o consentimento a qualquer momento.',
  en: 'I authorise AtlasHub to contact me about this request and to process this data for that purpose. I can withdraw consent at any time.',
  es: 'Autorizo a AtlasHub a contactarme sobre esta solicitud y a tratar estos datos con ese fin. Puedo retirar el consentimiento en cualquier momento.',
  fr: "J'autorise AtlasHub à me contacter au sujet de cette demande et à traiter ces données à cette fin. Je peux retirer mon consentement à tout moment.",
 },
 trial: {
  'pt-BR': 'Solicito um teste gratuito supervisionado pela AtlasHub, com dados de teste, sem cobrança e sem renovação automática.',
  'pt-PT': 'Peço um teste gratuito supervisionado pela AtlasHub, com dados de teste, sem cobrança e sem renovação automática.',
  en: 'I request a free trial supervised by AtlasHub, with test data, no charge and no automatic renewal.',
  es: 'Solicito una prueba gratuita supervisada por AtlasHub, con datos de prueba, sin cargo y sin renovación automática.',
  fr: "Je demande un essai gratuit supervisé par AtlasHub, avec des données de test, sans frais et sans renouvellement automatique.",
 },
};

export const DISCLAIMER: Record<CommerceLocale, string> = {
 'pt-BR': 'Hipótese calculada com os números informados. Não é uma previsão nem um resultado garantido.',
 'pt-PT': 'Hipótese calculada com os números indicados. Não é uma previsão nem um resultado garantido.',
 en: 'Hypothesis based on the figures provided. Not a forecast or a guaranteed result.',
 es: 'Hipótesis calculada con las cifras indicadas. No es una previsión ni un resultado garantizado.',
 fr: "Hypothèse calculée à partir des chiffres fournis. Ce n'est ni une prévision ni un résultat garanti.",
};
