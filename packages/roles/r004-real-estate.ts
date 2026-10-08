import { z } from 'zod';
import type { RoleDefinition } from './types.js';
import { l, ref, slotId, handoffTool } from './common.js';

const propertyId = z.string().min(1).max(120);

// ROLE-004 Consultor Imobiliário Digital: answers only from the agency's listings (never invents
// availability or price), captures qualified leads and requests visits. Price negotiation and
// offers always go to a human; a visit requires approval.
export const realEstateConsultant: RoleDefinition = {
 id: 'ROLE-004', packId: 'PACK-004', packSlug: 'real-estate-consultant', version: '0.1.0',
 name: l('Consultor Imobiliário Digital', 'Consultor Imobiliário Digital', 'Digital Real Estate Consultant', 'Consultor Inmobiliario Digital'),
 intents: [
  { id: 'negotiate', pattern: /(desconto|discount|descuento|negoci|baixar o pre|bajar el precio|rebaja|contraproposta|oferta de|make an offer|offer\b|aceita[mn]? .*(mil|k\b|€|\$))/i },
  { id: 'visit', pattern: /(visit|ver o im|ver la casa|ver el piso|ver a casa|agendar visita|marcar visita|cita para ver|tour\b)/i },
  { id: 'search', pattern: /(procur|looking for|busco|buscando|\bt[0-6]\b|quarto|bedroom|habitaci|apartamento|apartment|casa\b|house|piso\b|moradia|im[óo]vel|property|inmueble|arrendar|alugar|rent|comprar|buy)/i },
 ],
 tools: {
  'property.search': {
   input: z.object({ city: z.string().max(80).optional(), max_price: z.number().int().positive().optional(), bedrooms: z.number().int().min(0).max(10).optional() }).strict(),
   policy: 'auto', effect: false,
   async run({ sb }, i) {
    const all = await sb.list('property', 200);
    const hits = all.filter(p => p.data.available === true && (!i.city || String(p.data.city).toLowerCase() === i.city.toLowerCase()) && (!i.max_price || p.data.price <= i.max_price) && (i.bedrooms === undefined || p.data.bedrooms >= i.bedrooms));
    return { results: hits.slice(0, 3).map(p => ({ id: p.key, city: p.data.city, price: p.data.price, currency: p.data.currency, bedrooms: p.data.bedrooms })) };
   },
  },
  'property.get': {
   input: z.object({ property_id: propertyId }).strict(), policy: 'auto', effect: false,
   async run({ sb }, i) { const p = await sb.get('property', i.property_id); if (!p) throw new Error('record_missing'); return { id: p.key, available: p.data.available === true, city: p.data.city }; },
  },
  'lead.capture': {
   input: z.object({ ref, criteria: z.record(z.string(), z.union([z.string(), z.number()])) }).strict(), policy: 'auto', effect: true,
   async run({ sb }, i) { await sb.put('lead', i.ref, { criteria: i.criteria, status: 'new' }); return { captured: true }; },
  },
  'visit.schedule': {
   input: z.object({ ref, property_id: propertyId, slot: slotId }).strict(), policy: 'approval', effect: true,
   summary: i => ({ lead: i.ref, property: i.property_id, slot: i.slot }),
   async run({ sb }, i) { const s = await sb.get('slot', i.slot); if (!s || s.data.booked) throw new Error('slot_conflict'); await sb.update('slot', i.slot, s.version, { ...s.data, booked: true, property: i.property_id, lead: i.ref }); return { scheduled: true, starts_at: s.data.starts_at }; },
  },
  'offer.submit': { input: z.object({ ref, property_id: propertyId }).strict(), policy: 'forbidden', effect: true },
  'team.handoff': handoffTool,
 },
 replies: {
  results: l('Encontrámos {count} imóveis disponíveis: {list}.', 'Encontramos {count} imóveis disponíveis: {list}.', 'We found {count} available properties: {list}.', 'Hemos encontrado {count} inmuebles disponibles: {list}.'),
  none: l('De momento não temos imóveis disponíveis com esses critérios. Registámos o seu pedido e avisamos quando surgir algo.', 'No momento não temos imóveis disponíveis com esses critérios. Registramos seu pedido e avisamos quando surgir algo.', 'We have no available properties matching those criteria right now. We have saved your request and will let you know.', 'Ahora mismo no tenemos inmuebles disponibles con esos criterios. Hemos registrado su solicitud y le avisaremos.'),
  visit: l('Visita confirmada para {starts_at}.', 'Visita confirmada para {starts_at}.', 'Viewing confirmed for {starts_at}.', 'Visita confirmada para el {starts_at}.'),
  unavailable: l('Esse imóvel já não está disponível.', 'Esse imóvel não está mais disponível.', 'That property is no longer available.', 'Ese inmueble ya no está disponible.'),
 },
 async playbook(c) {
  if (c.intent === 'negotiate') return { state: 'handoff', reason: 'price_negotiation', reply: c.t('handoff') };
  if (c.intent === 'unknown') return { state: 'handoff', reason: 'unknown', reply: c.t('handoff') };
  if (c.intent === 'visit') {
   const id = String(c.data.property_id ?? '');
   const p = id ? await c.call('property.get', { property_id: id }).catch(() => null) : null;
   if (!p || p.status !== 'ok') return { state: 'blocked', reason: 'record_missing', reply: c.t('not_found') };
   if (!p.output.available) return { state: 'completed', reply: c.t('unavailable') };
   if (c.data.consent !== true) return { state: 'blocked', reason: 'consent_missing', reply: c.t('consent') };
   const slot = (await c.sb.list('slot', 50)).find(s => !s.data.booked && Date.parse(s.data.starts_at) > Date.now() && (c.data.slot === undefined || s.key === c.data.slot));
   if (!slot) return { state: 'handoff', reason: 'no_slots', reply: c.t('handoff') };
   const v = await c.call('visit.schedule', { ref: c.ref, property_id: id, slot: slot.key });
   if (v.status === 'pending') return { state: 'awaiting_approval' };
   if (v.status === 'rejected') return { state: 'cancelled', reply: c.t('rejected') };
   return { state: 'completed', reply: c.t('visit', { starts_at: v.output.starts_at }), result: { property: id, slot: slot.key } };
  }
  const criteria = { ...(typeof c.data.city === 'string' ? { city: c.data.city } : {}), ...(Number.isInteger(c.data.max_price) ? { max_price: c.data.max_price } : {}), ...(Number.isInteger(c.data.bedrooms) ? { bedrooms: c.data.bedrooms } : {}) };
  const found = await c.call('property.search', criteria);
  const results = found.status === 'ok' ? found.output.results as { id: string; city: string; price: number; currency: string; bedrooms: number }[] : [];
  if (!results.length) {
   if (c.data.consent === true) await c.call('lead.capture', { ref: c.ref, criteria });
   return { state: 'completed', reply: c.t('none'), result: { results: [] } };
  }
  if (c.data.consent === true) await c.call('lead.capture', { ref: c.ref, criteria });
  const list = results.map(r => `${r.id} (${r.city}, T${r.bedrooms}, ${r.price} ${r.currency})`).join('; ');
  return { state: 'completed', reply: c.t('results', { count: results.length, list }), result: { results: results.map(r => r.id) } };
 },
};
