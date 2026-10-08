import { z } from 'zod';
import type { RoleDefinition } from './types.js';
import { l, locale, handoffTool } from './common.js';

const postId = z.string().min(1).max(120);
const channel = z.enum(['linkedin', 'instagram', 'facebook', 'blog', 'newsletter']);

// ROLE-006 Assistente de Marketing: research from approved sources, post drafts, editorial
// scheduling and reports. Scheduling requires approval; direct publishing is forbidden.
export const marketingAssistant: RoleDefinition = {
 id: 'ROLE-006', packId: 'PACK-006', packSlug: 'marketing-assistant', version: '0.1.0',
 name: l('Assistente de Marketing', 'Assistente de Marketing', 'Marketing Assistant', 'Asistente de Marketing'),
 intents: [
  { id: 'report', pattern: /(relat[óo]rio|report|informe|m[ée]tricas|metrics|resultados|performance|desempe)/i },
  { id: 'schedule', pattern: /(agend|schedule|programa|calend[áa]rio editorial|publica|publish)/i },
  { id: 'draft', pattern: /(post\b|rascunho|draft|borrador|conte[úu]do|content|art[íi]go|article|legenda|caption|copy\b)/i },
  { id: 'research', pattern: /(pesquis|research|investiga|tend[êe]ncia|trend|fontes|sources|not[íi]cias|news|ideias|ideas)/i },
 ],
 tools: {
  'research.collect': {
   input: z.object({ topic: z.string().min(1).max(80) }).strict(), policy: 'auto', effect: false,
   async run({ sb }, i) { const t = i.topic.toLowerCase(); return { items: (await sb.list('source', 100)).filter(s => String(s.data.topic).toLowerCase().includes(t)).slice(0, 5).map(s => ({ title: s.data.title, url: s.data.url, licensed: s.data.licensed === true })) }; },
  },
  'post.draft': {
   input: z.object({ post_id: postId, topic: z.string().min(1).max(80), channel, locale, text: z.string().min(1).max(2200), sources: z.array(z.string().url()).max(5) }).strict(), policy: 'auto', effect: true,
   async run({ sb }, i) { const prev = await sb.get('post', i.post_id); if (prev && prev.data.status !== 'draft') return { status: prev.data.status }; await sb.put('post', i.post_id, { ...i, status: 'draft' }); return { status: 'draft' }; },
  },
  'post.schedule': {
   input: z.object({ post_id: postId, at: z.string().datetime() }).strict(), policy: 'approval', effect: true,
   summary: i => ({ post: i.post_id, at: i.at }),
   async run({ sb }, i) { const p = await sb.get('post', i.post_id); if (!p) throw new Error('record_missing'); if (p.data.status !== 'draft') throw new Error('invalid_state'); await sb.update('post', i.post_id, p.version, { ...p.data, status: 'scheduled', scheduled_at: i.at }); return { status: 'scheduled' }; },
  },
  'post.publish': { input: z.object({ post_id: postId }).strict(), policy: 'forbidden', effect: true },
  'report.generate': {
   input: z.object({ period: z.string().regex(/^\d{4}-\d{2}$/) }).strict(), policy: 'auto', effect: false,
   async run({ sb }, i) { const m = (await sb.list('metric', 500)).filter(r => String(r.data.period) === i.period); const sum = (k: string) => m.reduce((a, r) => a + (Number(r.data[k]) || 0), 0); return { posts: m.length, impressions: sum('impressions'), clicks: sum('clicks'), leads: sum('leads') }; },
  },
  'team.handoff': handoffTool,
 },
 replies: {
  research: l('Encontrei {count} fontes aprovadas sobre "{topic}".', 'Encontrei {count} fontes aprovadas sobre "{topic}".', 'I found {count} approved sources about "{topic}".', 'He encontrado {count} fuentes aprobadas sobre "{topic}".'),
  draft: l('Rascunho {post} criado para {channel}, a aguardar revisão.', 'Rascunho {post} criado para {channel}, aguardando revisão.', 'Draft {post} created for {channel}, awaiting review.', 'Borrador {post} creado para {channel}, pendiente de revisión.'),
  draft_text: l('{topic}: o que as empresas precisam de saber este mês. Leia mais no nosso blogue.', '{topic}: o que as empresas precisam saber este mês. Leia mais no nosso blog.', '{topic}: what businesses need to know this month. Read more on our blog.', '{topic}: lo que las empresas deben saber este mes. Lea más en nuestro blog.'),
  scheduled: l('Publicação {post} agendada.', 'Publicação {post} agendada.', 'Post {post} scheduled.', 'Publicación {post} programada.'),
  report: l('Relatório {period}: {posts} publicações, {impressions} impressões, {clicks} cliques, {leads} leads.', 'Relatório {period}: {posts} publicações, {impressions} impressões, {clicks} cliques, {leads} leads.', 'Report {period}: {posts} posts, {impressions} impressions, {clicks} clicks, {leads} leads.', 'Informe {period}: {posts} publicaciones, {impressions} impresiones, {clicks} clics, {leads} leads.'),
  no_sources: l('Não há fontes aprovadas sobre esse tema; a equipa vai rever.', 'Não há fontes aprovadas sobre esse tema; a equipe vai revisar.', 'There are no approved sources on that topic; the team will review.', 'No hay fuentes aprobadas sobre ese tema; el equipo lo revisará.'),
 },
 async playbook(c) {
  if (c.intent === 'unknown') return { state: 'handoff', reason: 'unknown', reply: c.t('handoff') };
  if (c.intent === 'report') {
   const period = typeof c.data.period === 'string' ? c.data.period : new Date().toISOString().slice(0, 7);
   const r = await c.call('report.generate', { period });
   if (r.status !== 'ok') return { state: 'blocked', reason: 'invalid_period', reply: c.t('not_found') };
   return { state: 'completed', reply: c.t('report', { period, ...r.output }), result: r.output };
  }
  const topic = String(c.data.topic ?? '').slice(0, 80);
  if (!topic && c.intent !== 'schedule') return { state: 'handoff', reason: 'missing_topic', reply: c.t('handoff') };
  if (c.intent === 'research') {
   const r = await c.call('research.collect', { topic });
   const n = r.status === 'ok' ? r.output.items.length : 0;
   return n ? { state: 'completed', reply: c.t('research', { count: n, topic }), result: { sources: r.status === 'ok' ? r.output.items : [] } } : { state: 'handoff', reason: 'no_sources', reply: c.t('no_sources') };
  }
  const postIdValue = String(c.data.post_id ?? `post-${c.ref}`).slice(0, 120);
  if (c.intent === 'schedule') {
   const at = String(c.data.at ?? '');
   if (!z.string().datetime().safeParse(at).success || !(await c.sb.get('post', postIdValue))) return { state: 'blocked', reason: 'record_missing', reply: c.t('not_found') };
   const s = await c.call('post.schedule', { post_id: postIdValue, at });
   if (s.status === 'pending') return { state: 'awaiting_approval' };
   if (s.status === 'rejected') return { state: 'cancelled', reply: c.t('rejected') };
   return { state: 'completed', reply: c.t('scheduled', { post: postIdValue }), result: { status: 'scheduled' } };
  }
  const ch = channel.safeParse(c.data.channel).success ? c.data.channel : 'linkedin';
  const sources = await c.call('research.collect', { topic });
  const licensed = sources.status === 'ok' ? (sources.output.items as { url: string; licensed: boolean }[]).filter(s => s.licensed).map(s => s.url) : [];
  const text = await c.draft('social_post', { topic, channel: ch }, c.t('draft_text', { topic }));
  await c.call('post.draft', { post_id: postIdValue, topic, channel: ch, locale: c.locale, text, sources: licensed });
  return { state: 'completed', reply: c.t('draft', { post: postIdValue, channel: ch }), result: { post_id: postIdValue, status: 'draft', sources: licensed.length } };
 },
};
