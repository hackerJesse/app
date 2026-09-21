# Zatriz (ex N-Security InfraManager) — PRD

## Visão
App Android/iOS (Expo) + FastAPI + MongoDB para gestão de TI: orçamentos (PDF), clientes, racks até 50U, topologia de rede (Packet Tracer-like), plantas baixas com pontos de rede, mapa do Brasil com servidores monitorados, inventário de dispositivos com etiquetas QR e manutenções.

Idioma do usuário: pt-BR. Tema escuro (paleta atual laranja/preto → será trocada para preto+azul com opção de tema, Fase 2).

## Login
- E-mail/senha: jesse.araujo@nsecurity.com.br / 3645QPwo$ (admin)
- Google (Emergent-managed) — `/api/auth/session`

## Implementado
### Backend (`/app/backend/server.py`)
- Auth (login, session Google, me, logout), sessões 7 dias
- CRUD: clients, quotes (+status), racks, topologies, floorplans (+rooms), servers (+check TCP/latência, check-all), devices (+find por QR/patrimônio/série), maintenances (preventiva atualiza last_preventive)
- Upload de imagens → Emergent Object Storage (`/api/upload`, `/api/files/{path}?token=`)
- Dashboard com contadores (inclui devices_total, preventive_overdue, preventive_soon)

### Frontend (`/app/frontend`)
- Tabs: Início, Dispositivos, Orçamentos, Infra (racks/topologias/plantas), Servidores (mapa). Clientes em `/clients`.
- Orçamentos: editor com itens, desconto, impostos, status, impressão/PDF (expo-print)
- Rack builder: lista de U, toque em slot abre sheet com catálogo (switch, patch panel, servidor...), PDF
- Topologia: canvas com pinch/pan, arrastar nós, conectar (toque origem → destino), editar link, auto-geração, PDF
- Planta: upload imagem ou desenho (cômodos), pontos de rede por toque
- Mapa Brasil (SVG) com pins pulsantes, sheet com dados sensíveis "toque para revelar", cidades presets
- Dispositivos: cadastro por tipo com specs, foto (câmera/galeria), patrimônio/série/setor, preventiva; detalhe com histórico, registrar preventiva/corretiva, etiqueta 7,5×4,5 cm com QR (impressão), leitor QR (`/scan`, expo-camera) + busca manual
- Dashboard: alerta de preventivas vencidas/próximas, métricas clicáveis, ações rápidas

## Implementado (fases 2-4)
- Tema preto+azul (dark) + claro + sistema (Configurações), botões pill menores, menu hambúrguer (sem bottom tabs), dashboard com gráficos (manutenções/mês, donut por tipo, latência, hero), mapa no dashboard
- Logo/nome da empresa (admin) em app e PDFs; latência de alerta configurável
- Mapa com estados coloridos por região, cidades ao dar zoom (pinch + botões), pins com cidade
- Agente de monitoramento: POST /api/agent/metrics (X-Agent-Key), scripts Linux/Windows gerados (/servers/{id}/agent-script), docs em /app/docs/agente-monitoramento.md
- Assinatura: /auth/register (nome, CPF, endereço), /account/contract (aceite + IP), /billing/checkout (Stripe: mensal R$25,90 subscription | vitalício R$999 payment), /billing/status, /billing/me, webhook opcional; 402 para rotas de dados sem acesso; um dispositivo por usuário (sessões antigas removidas no login); bloqueio automático mensal após 33 dias sem pagamento; admin: /admin/subscribers + bloquear/desbloquear
- Rack com faces realistas (SVG) e LEDs piscando; servidor torre

## Implementado (fase 5 + extras)
- Biometria: toggle em Configurações (nativo); ao sair mantém credencial segura; botão "Entrar com biometria" no login
- Idiomas pt/en/es (`src/i18n.ts`, salvo em `user.language` via PUT /account/profile) — cobre menu, login, dashboard, configurações e cabeçalhos; telas internas ainda em pt
- Estado + cidade (todos os municípios do Brasil, `backend/br_cities.json`, GET /geo/states, /geo/cities?uf=) no cadastro de cliente e servidor (posiciona no mapa)
- Manual em PDF: `/app/docs/manual-inframanager.pdf` (gerar com `python3 /app/docs/build_manual.py`, imagens em /app/docs/img) — link no menu (GET /api/docs/manual?token=)

## Implementado (fase 6 — Zatriz)
- App renomeado para **Zatriz** (login "ZATRIZ · ACESSO RESTRITO"; Google Auth removido)
- Operador (sub-usuário sem excluir), SMTP + alertas por e-mail (servidor offline / preventivas), aprovação manual de assinatura, filtros de orçamentos, contrato PDF no cliente, links de tutorial (PDF/vídeo) em Configurações
- **PDF/impressão corrigidos**: web gera PDF real para download (html2canvas + jsPDF, A4 ou etiqueta 75×45 mm exata, canto superior esquerdo); "Imprimir" na web imprime só o documento (iframe); nativo usa expo-print + share com fallback
- **Foto do dispositivo**: upload nativo via `expo-file-system/legacy` `uploadAsync` (fetch+FormData falhava no Android)
- **Redefinir senha**: `/forgot` (login → "Esqueci minha senha") → POST /auth/forgot-password (código 6 dígitos por e-mail via SMTP configurado, 15 min, 5 tentativas, rate-limit) → POST /auth/reset-password (troca senha e derruba sessões). Exige SMTP configurado pelo admin.
- **Excluir assinante**: DELETE /admin/subscribers/{id} (remove conta, operador vinculado e sessões) — ícone lixeira em Admin › Assinantes
- Login: banner Zatriz padrão (assets/images/zatriz-banner.png; imagem customizada em Configurações substitui), formulário mais alto, KeyboardAvoidingView "height" no Android; splash com o banner Zatriz (fundo #0A0A0B)

## Backlog (ordem acordada com o usuário)
- Traduzir telas internas (formulários, sheets) para en/es
- Testes automatizados finais (usuário fará manualmente)
