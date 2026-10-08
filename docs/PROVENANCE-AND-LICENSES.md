# Origem e licenças

Código novo escrito especificamente para este projeto; nenhum template de terceiros, snippet Hermes/OpenClaw ou workflow externo importado. PACK-001 existente preservado; snapshot manifestado no control plane é proveniente de atlas-agent-packs no commit de baseline. Hash SHA-256 armazenado em PackRelease. PACK-002/003 criados pelo scaffold próprio do repositório e preenchidos com dados sintéticos.

| Componente direto | Origem | Licença / revisão |
|---|---|---|
| NestJS, TypeScript, jose, zod, pg, BullMQ, ioredis, Playwright, openapi-typescript | pacotes npm oficiais, versões exatas em lockfile | MIT |
| Prisma/client/adapter-pg | pacotes npm oficiais | Apache-2.0 |
| PostgreSQL 17.6 | imagem oficial Docker, digest fixado | PostgreSQL License |
| Redis 7.4.5 | imagem oficial Docker, digest fixado | RSALv2/SSPLv1; rever enquadramento do serviço gerido antes de distribuição/comercialização |
| Node 22.20.0 | imagem oficial Docker, digest fixado | MIT e componentes incluídos |
| Next/React/Tailwind existentes | dependências preservadas do frontend | MIT; lockfile existente |
| n8n/Hermes remotos | não instalados nem auditados nesta sessão | Enquadramento/licenças por confirmar; n8n nunca disponibilizado como editor cliente |

Esta tabela não substitui inventário transitivo/SBOM ou parecer jurídico. npm ci preserva integridade do lockfile; TLS/checksums não foram desativados para contornar falhas. Nenhuma origem não verificada utilizada no runtime.
