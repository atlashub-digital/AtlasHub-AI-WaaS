// Phase B staging seed: AtlasHub house tenant, issuers, mission templates (5 locales) and products.
// Prices are created as 'draft' (never shown or charged) until the Founder approves amounts.
// Same guard as scripts/seed.mjs: isolated waas_staging database only; never deletes.
import {PrismaClient} from '@prisma/client';import {PrismaPg} from '@prisma/adapter-pg';
if(process.env.AUTH_MODE!=='staging'||!process.env.DATABASE_URL?.includes('/waas_staging'))throw new Error('Seed only for isolated waas_staging database');
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
const HOUSE='atlashub';
await db.tenant.upsert({where:{id:HOUSE},create:{id:HOUSE,slug:'atlashub',name:'AtlasHub (house)'},update:{}});
for(const [userId,role] of [['house-owner','atlas_owner'],['house-operator','atlas_operator']])await db.membership.upsert({where:{tenantId_userId:{tenantId:HOUSE,userId}},create:{tenantId:HOUSE,userId,role},update:{}});
const issuers=[
 {id:'atlashub-uk',legalName:'AtlasHub Holding (UK) — razão social a confirmar',country:'GB',taxId:'UK-COMPANY-NUMBER-TBC',address:{country:'GB'},currencies:['EUR','USD'],series:'AH-UK',email:'billing@atlashub.digital'},
 {id:'atlashub-br',legalName:'AtlasHub Brasil — razão social a confirmar',country:'BR',taxId:'CNPJ-A-CONFIRMAR',address:{city:'Goiânia',country:'BR',line1:'GO'},currencies:['BRL'],series:'AH-BR',email:'financeiro@atlashub.digital'},
];
for(const i of issuers)await db.billingIssuer.upsert({where:{id:i.id},create:i,update:{}});
// [role, capacity, pt-BR, pt-PT, en, es, fr] each locale: [name, objective, scopeIn, scopeOut]
const T=[
 ['ROLE-001',{conversations_per_month:500},
  ['Recepcionista Digital','Confirmar e remarcar consultas sem sobrecarregar a recepção.','Confirmações, remarcações aprovadas, lista de espera, encaminhamento para a equipe.','Orientação clínica, cobranças, mensagens sem consentimento.'],
  ['Rececionista Digital','Confirmar e remarcar consultas sem sobrecarregar a receção.','Confirmações, remarcações aprovadas, lista de espera, passagem para a equipa.','Aconselhamento clínico, cobranças, mensagens sem consentimento.'],
  ['Digital Receptionist','Confirm and reschedule appointments without overloading the front desk.','Confirmations, approved rescheduling, waitlist, handoff to the team.','Clinical advice, payments, messages without consent.'],
  ['Recepcionista Digital','Confirmar y reprogramar citas sin sobrecargar la recepción.','Confirmaciones, reprogramaciones aprobadas, lista de espera, traspaso al equipo.','Consejo clínico, cobros, mensajes sin consentimiento.'],
  ['Réceptionniste numérique','Confirmer et replanifier les rendez-vous sans surcharger l’accueil.','Confirmations, replanifications approuvées, liste d’attente, transfert à l’équipe.','Conseil médical, paiements, messages sans consentement.']],
 ['ROLE-002',{leads_per_month:300},
  ['Assistente Comercial','Qualificar leads e preparar o próximo passo comercial.','Qualificação, CRM, agendamento de reuniões e follow-ups aprovados.','Campanhas autônomas, envio sem aprovação, descontos.'],
  ['Assistente Comercial','Qualificar leads e preparar o próximo passo comercial.','Qualificação, CRM, marcação de reuniões e follow-ups aprovados.','Campanhas autónomas, envio sem aprovação, descontos.'],
  ['Sales Assistant','Qualify leads and prepare the next sales step.','Qualification, CRM, meeting booking and approved follow-ups.','Autonomous campaigns, sending without approval, discounts.'],
  ['Asistente Comercial','Cualificar leads y preparar el siguiente paso comercial.','Cualificación, CRM, reuniones y seguimientos aprobados.','Campañas autónomas, envíos sin aprobación, descuentos.'],
  ['Assistant commercial','Qualifier les leads et préparer la prochaine étape commerciale.','Qualification, CRM, prise de rendez-vous et relances approuvées.','Campagnes autonomes, envois sans approbation, remises.']],
 ['ROLE-003',{emails_per_month:600},
  ['Secretária Administrativa','Organizar a caixa de entrada e a agenda da equipe.','Triagem, rascunhos de resposta, reservas de horário aprovadas, resumos.','Enviar emails, assumir compromissos sem aprovação.'],
  ['Secretária Administrativa','Organizar a caixa de entrada e a agenda da equipa.','Triagem, rascunhos de resposta, reservas de horário aprovadas, resumos.','Enviar emails, assumir compromissos sem aprovação.'],
  ['Administrative Assistant','Keep the team inbox and calendar organised.','Triage, reply drafts, approved calendar holds, briefs.','Sending email, commitments without approval.'],
  ['Secretaria Administrativa','Organizar la bandeja de entrada y la agenda del equipo.','Clasificación, borradores, reservas aprobadas, resúmenes.','Enviar emails, compromisos sin aprobación.'],
  ['Assistante administrative','Organiser la boîte de réception et l’agenda de l’équipe.','Tri, brouillons de réponse, réservations approuvées, synthèses.','Envoyer des emails, engagements sans approbation.']],
 ['ROLE-004',{conversations_per_month:400},
  ['Consultor Imobiliário Digital','Responder a interessados só com imóveis reais e marcar visitas.','Pesquisa na carteira, captação de leads, visitas aprovadas.','Inventar imóveis ou preços, negociar valores.'],
  ['Consultor Imobiliário Digital','Responder a interessados só com imóveis reais e marcar visitas.','Pesquisa na carteira, captação de leads, visitas aprovadas.','Inventar imóveis ou preços, negociar valores.'],
  ['Digital Real Estate Consultant','Answer prospects with real listings only and book viewings.','Listing search, lead capture, approved viewings.','Inventing properties or prices, negotiating.'],
  ['Consultor Inmobiliario Digital','Responder solo con inmuebles reales y agendar visitas.','Búsqueda en cartera, captación, visitas aprobadas.','Inventar inmuebles o precios, negociar.'],
  ['Conseiller immobilier numérique','Répondre uniquement avec des biens réels et planifier des visites.','Recherche dans le portefeuille, captation, visites approuvées.','Inventer des biens ou des prix, négocier.']],
 ['ROLE-005',{conversations_per_month:1000},
  ['Assistente E-commerce','Atender pedidos de clientes com verificação de identidade.','Status de pedidos, prazos, devoluções na política, reembolsos aprovados.','Movimentar dinheiro, revelar dados sem verificação.'],
  ['Assistente E-commerce','Atender pedidos de clientes com verificação de identidade.','Estado de encomendas, prazos, devoluções na política, reembolsos aprovados.','Movimentar dinheiro, revelar dados sem verificação.'],
  ['E-commerce Assistant','Serve customer requests with identity verification.','Order status, delivery times, in-policy returns, approved refunds.','Moving money, revealing data before verification.'],
  ['Asistente E-commerce','Atender pedidos con verificación de identidad.','Estado de pedidos, plazos, devoluciones en política, reembolsos aprobados.','Mover dinero, revelar datos sin verificación.'],
  ['Assistant e-commerce','Traiter les demandes clients avec vérification d’identité.','Suivi de commande, délais, retours conformes, remboursements approuvés.','Déplacer de l’argent, révéler des données sans vérification.']],
 ['ROLE-006',{posts_per_month:20},
  ['Assistente de Marketing','Pesquisar, rascunhar e agendar conteúdo com aprovação.','Pesquisa em fontes aprovadas, rascunhos, agendamento aprovado, relatórios.','Publicar sozinho, usar conteúdo sem licença.'],
  ['Assistente de Marketing','Pesquisar, redigir e agendar conteúdo com aprovação.','Pesquisa em fontes aprovadas, rascunhos, agendamento aprovado, relatórios.','Publicar sozinho, usar conteúdo sem licença.'],
  ['Marketing Assistant','Research, draft and schedule content with approval.','Approved-source research, drafts, approved scheduling, reports.','Publishing alone, using unlicensed content.'],
  ['Asistente de Marketing','Investigar, redactar y programar contenido con aprobación.','Investigación, borradores, programación aprobada, informes.','Publicar solo, usar contenido sin licencia.'],
  ['Assistant marketing','Rechercher, rédiger et planifier du contenu avec approbation.','Veille sur sources approuvées, brouillons, planification approuvée, rapports.','Publier seul, utiliser du contenu sans licence.']],
 ['ROLE-007',{invoices_per_month:300},
  ['Assistente Financeiro Administrativo','Registrar faturas, propor conciliações e preparar cobranças.','Registro sem duplicados, conciliação proposta, lembretes aprovados.','Transferências e pagamentos.'],
  ['Assistente Financeiro Administrativo','Registar faturas, propor conciliações e preparar cobranças.','Registo sem duplicados, conciliação proposta, lembretes aprovados.','Transferências e pagamentos.'],
  ['Finance Admin Assistant','Register invoices, propose reconciliations and prepare reminders.','Duplicate-free registration, proposed reconciliation, approved reminders.','Transfers and payments.'],
  ['Asistente Financiero Administrativo','Registrar facturas, proponer conciliaciones y preparar cobros.','Registro sin duplicados, conciliación propuesta, recordatorios aprobados.','Transferencias y pagos.'],
  ['Assistant financier administratif','Enregistrer les factures, proposer des rapprochements et préparer les relances.','Enregistrement sans doublon, rapprochement proposé, relances approuvées.','Virements et paiements.']],
 ['ROLE-008',{applications_per_month:200},
  ['Assistente de RH','Receber candidaturas e organizar entrevistas sem decisões automáticas.','Candidaturas com consentimento, dúvidas do processo, entrevistas aprovadas.','Classificar, rejeitar ou contratar candidatos.'],
  ['Assistente de RH','Receber candidaturas e organizar entrevistas sem decisões automáticas.','Candidaturas com consentimento, dúvidas do processo, entrevistas aprovadas.','Classificar, rejeitar ou contratar candidatos.'],
  ['HR Assistant','Receive applications and organise interviews without automated decisions.','Consented applications, process questions, approved interviews.','Ranking, rejecting or hiring candidates.'],
  ['Asistente de RR. HH.','Recibir candidaturas y organizar entrevistas sin decisiones automáticas.','Candidaturas con consentimiento, dudas del proceso, entrevistas aprobadas.','Clasificar, rechazar o contratar candidatos.'],
  ['Assistant RH','Recevoir les candidatures et organiser les entretiens sans décision automatique.','Candidatures consenties, questions sur le processus, entretiens approuvés.','Classer, rejeter ou embaucher des candidats.']],
];
const L=['pt-BR','pt-PT','en','es','fr'];
for(const [roleId,capacity,...texts] of T){
 const n=roleId.slice(-3),templateId=`tpl-${n}-standard`,productId=`prd-${n}-mission`;
 await db.catalogMissionTemplate.upsert({where:{id:templateId},create:{id:templateId,roleId,kind:'standard',capacity,includedAddons:[],optionalAddons:[],status:'active'},update:{}});
 await db.catalogProduct.upsert({where:{id:productId},create:{id:productId,kind:'mission',roleId,templateId,status:'active'},update:{}});
 for(const [k,[name,objective,scopeIn,scopeOut]] of texts.entries()){
  await db.catalogMissionTemplateI18n.upsert({where:{templateId_locale:{templateId,locale:L[k]}},create:{templateId,locale:L[k],name,objective,scopeIn,scopeOut},update:{}});
  await db.catalogProductI18n.upsert({where:{productId_locale:{productId,locale:L[k]}},create:{productId,locale:L[k],name,description:objective},update:{}});
 }
 for(const currency of ['BRL','EUR','USD'])await db.catalogPrice.upsert({where:{id:`${productId}-${currency.toLowerCase()}-month`},create:{id:`${productId}-${currency.toLowerCase()}-month`,productId,currency,pricingModel:'flat',interval:'month',amountMinor:null,trialDays:7,status:'draft'},update:{}});
}
console.log('Commerce seed: house tenant, 2 issuers, 8 templates x 5 locales, 8 products, 24 draft prices; existing data preserved');
await db.$disconnect();
