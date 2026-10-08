# Auditoria dos repositórios — 2026-10-07
## atlas-agent-packs
Confirmados README, INDEX, documentação de arquitetura e ciclo de vida. Há um pack em estado `demo` (`PACK-001 clinic-appointment-confirmation`) com 3 cenários simulados, 5 tools descritas, 4 guardrails e métricas. `npm run check`, gerador de catálogo e testes constam do projeto. Workflows reais n8n do PACK-001 não estão implementados; aceitação com Hermes real não foi demonstrada. Conservar este repositório como biblioteca técnica. Não prometer packs em `demo` como produtos operacionais.

## App.AtlasHub.Si
README declara V0 em Next.js sem backend nem LLM, catálogo sincronizado e simulação no browser. Clara V0 é guião, não agente autónomo. O README relata 10 testes de lógica e smoke test no browser, mas build/lint/typecheck reais e deploy não foram comprovados nessa documentação. Evoluir UI para comunicar «serviço gerido», preservar simulador e separar rotas públicas de portal autenticado.

## AtlasHub-AI-WaaS
Na inspeção inicial continha apenas README de 2 linhas. Torna-se a fonte de verdade do projeto, com charter, arquitetura, modelo de negócio, roadmap, contratos operacionais e requisitos. Não duplicar runtime aqui até haver ADR explícita.

## Integração externa
`enescingoz/awesome-n8n-templates` oferece workflows JSON de terceiros; `aliaihub/awesome-hermes-usecases` e `hesamsheikh/awesome-openclaw-usecases` são catálogos de casos de uso, nem todos executáveis. Rever licenças de cada template, segurança, dependências, permissão de uso e atualização. Importar apenas o necessário, com provenance e aprovação; não executar snippets sem auditoria.

## Recomendação
Operar produto em paralelo ao simulador: Clara vende a prestação gerida; Agent Packs define competências; AI-WaaS gere a relação comercial, deployment e supervisão; Hermes/n8n/Atendimento.Center executam. O projeto PaperClip (atlas-si-os) permanece em standby e não constitui dependência. Não reescrever a stack atual.

## Limitações da presente auditoria
Análise fundamentada em metadados, README e INDEX/documentos de arquitetura disponíveis no GitHub; não inclui execução de CI, inspeção integral de todos os ficheiros, testes contra infra viva ou confirmação de produção. Esses passos são P0 do roadmap.
