# ADR-001 — execução determinística e migrations verificáveis

Estado: implementada para staging local; revisão necessária antes de homologação.

NestJS/TypeScript, Prisma, Postgres e BullMQ/Redis seguem o blueprint. O calendário stateful é PostgreSQL sintético, com optimistic concurrency e reserva atómica. Não se instala uma segunda instância de Hermes ou n8n sem inventário da VPS. O executor não usa LLM: instruções recebidas são dados, tenant e consentimento vêm de registos persistidos.

Prisma 6.16.2 engineType=client e PrismaPg usam WASM/JavaScript recebidos por npm com integridade verificada. O download do engine nativo estava bloqueado por egress; a verificação de checksum nunca foi desativada. A configuração experimental de migration adapter consegue gerar SQL, mas `prisma migrate deploy` falhou ao desserializar pg_catalog.name. Uma tentativa com 6.19.0 exigiu novamente binários bloqueados; voltou-se a 6.16.2.

Alternativa escolhida: aplicar SQL Prisma com pg numa transação, advisory lock e checksum SHA-256 em waas_migrations. Reexecução não reaplica migrations e alterações de migrations aplicadas são rejeitadas. Este histórico não é `_prisma_migrations`; não alternar runners sem procedimento de baseline aprovado. Prisma continua ORM e schema, mas o CLI migrate não está certificado neste ambiente.

Simplificações: controller único para control plane, módulos separados para identidade, política, worker e connector; sem subscriptions comerciais/billing automático. Snapshot do manifesto PACK-001 é um artefacto imutável do control plane para bootstrap/CI, não uma segunda biblioteca de packs. ROLE-002/003 são demos apenas. Estados pilot/active são bloqueados pela API até homologação.

RLS é default deny para acesso direto a tabelas por utilizadores não privilegiados; o backend local usa proprietário DB e aplica scope no código e FKs compostas. **Isto não prova RLS por tenant na ligação privilegiada do backend.** Antes de Supabase remoto: criar role mínima de runtime e políticas/contexto por tenant, testar com identidades reais; não usar service_role do cliente nem superuser em produção.

Rollback de aplicação: parar admissão/worker, reverter imagem/commit compatível e verificar readiness. Rollback de dados: restore num novo destino, conferir integridade e só então trocar ligação. Não fornecer down destrutivo para apagar dados de aplicação. A migration inicial pode ser descartada exclusivamente recriando uma base local vazia; migrations em produção requerem forward-fix ou restore aprovado.
