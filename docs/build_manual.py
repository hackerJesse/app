#!/usr/bin/env python3
"""Gera o manual do usuário em PDF (HTML + Chrome headless) com as imagens em docs/img."""
import base64, os, subprocess, datetime

D = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(D, "img")


def img(name, cap=""):
    p = os.path.join(IMG, name)
    if not os.path.exists(p):
        return ""
    b = base64.b64encode(open(p, "rb").read()).decode()
    return f'<figure><img src="data:image/jpeg;base64,{b}"/><figcaption>{cap}</figcaption></figure>'


def sec(title, text, images=()):
    figs = "".join(img(n, c) for n, c in images)
    return f'<section><h2>{title}</h2><div class="row"><div class="txt">{text}</div><div class="figs">{figs}</div></div></section>'


agent_md = open(os.path.join(D, "agente-monitoramento.md"), encoding="utf-8").read()
agent_html = "<pre class='md'>" + agent_md.replace("&", "&amp;").replace("<", "&lt;") + "</pre>"

S = []
S.append(sec("1. Acesso e conta",
 """<p><b>Login</b>: informe e-mail e senha ou use <b>Entrar com Google</b>. Se você ativou a biometria em Configurações, o botão <b>Entrar com biometria</b> aparece na tela de login (no celular).</p>
 <p><b>Criar conta (assinatura)</b>: preencha nome completo, e-mail, senha, CPF, telefone e endereço. Em seguida aceite o <b>contrato digital</b> (ficam registrados nome, CPF, data/hora e IP) e escolha o plano:</p>
 <ul><li><b>Mensal</b> — R$ 25,90 por usuário/mês, renovação automática. Sem pagamento o acesso é bloqueado automaticamente.</li>
 <li><b>Licença vitalícia</b> — R$ 999,00 à vista (de R$ 1.500,00).</li></ul>
 <p>O pagamento é feito pelo Stripe (cartão). Após a confirmação o acesso é liberado. Cada usuário só pode estar conectado em <b>um dispositivo por vez</b>: um novo login encerra a sessão anterior.</p>""",
 [("01_login.jpeg", "Tela de login")]))
S.append(sec("2. Painel inicial (Dashboard)",
 """<p>Ao entrar você vê o resumo da operação: <b>dispositivos cadastrados</b>, <b>preventivas vencidas/próximas</b>, <b>servidores com instabilidade</b> (toque para abrir o mapa), <b>orçamentos pendentes</b>, gráfico de <b>manutenções dos últimos 6 meses</b> (preventivas × corretivas), distribuição de dispositivos <b>por tipo</b>, <b>latência</b> dos servidores, o <b>mapa</b> e as <b>topologias</b>. Tudo é clicável e leva à tela correspondente.</p>
 <p>O <b>menu ☰</b> (canto superior esquerdo) concentra todos os acessos: Início, Dispositivos, Ler QR Code, Orçamentos, Clientes, Infraestrutura, Servidores, Configurações e, para o administrador, Assinantes.</p>""",
 [("02_dashboard.jpeg", "Dashboard"), ("03_menu.jpeg", "Menu principal")]))
S.append(sec("3. Configurações",
 """<p><b>Aparência</b>: tema Escuro, Claro ou Sistema. <b>Idioma</b>: Português, Inglês ou Espanhol (salvo no perfil do usuário). <b>Segurança</b>: ativar login por biometria (digital/rosto) — no celular.</p>
 <p><b>Empresa e logo</b> (somente administrador): envie a logo em PNG ou SVG sem fundo; ela aparece no menu, nas etiquetas e nos relatórios em PDF. Defina o nome da empresa e a <b>latência de alerta</b> (ms) usada para marcar servidores instáveis.</p>""",
 [("04_settings.jpeg", "Configurações"), ("04b_settings_en.jpeg", "Idioma inglês")]))
S.append(sec("4. Dispositivos (inventário)",
 """<p>Lista todos os equipamentos com busca por <b>setor, patrimônio, número de série, nome, marca ou cliente</b> e filtros por tipo e por preventiva (<b>Vencidas</b> / <b>Próximas</b>). O ícone <b>QR</b> no topo abre o leitor.</p>
 <p><b>Cadastro</b>: escolha o tipo (Computador, Notebook, Servidor, Tablet, Impressora, Celular, Equipamento de rede, Outro). Os campos de configuração mudam conforme o tipo — ex.: computador tem processador, memória (quantidade, modelo, marca), HD/SSD, placa de vídeo, placa de rede, placa-mãe, monitor, teclado; notebook tem marca/modelo, memória, tipo de HD e processador; tablets, impressoras e celulares só marca e configuração. Campos em branco são permitidos.</p>
 <p>Informe <b>patrimônio</b>, <b>número de série</b>, <b>setor</b> onde está alocado, cliente, <b>foto</b> (pela câmera, no local) e a <b>periodicidade da preventiva</b> (ex.: computador a cada 3 meses, servidor a cada 6).</p>""",
 [("05_devices.jpeg", "Lista de dispositivos"), ("08_device_form.jpeg", "Cadastro por tipo")]))
S.append(sec("5. Ficha do dispositivo, etiqueta QR e manutenções",
 """<p>A ficha mostra foto, status, configuração, próxima preventiva e o <b>histórico</b> de manutenções.</p>
 <p><b>Etiqueta</b>: gera a etiqueta de <b>7,5 × 4,5 cm</b> com número do patrimônio, setor, número de série, configuração resumida, QR Code, logo da empresa e data/hora da impressão (pequeno, embaixo). Toque em <b>Imprimir</b> para enviar à impressora de etiquetas ou salvar em PDF.</p>
 <p><b>Preventiva feita</b>: registra a data/hora em que a limpeza/revisão foi realizada e recalcula a próxima. <b>Corretiva</b>: registra o que aconteceu (ex.: "fonte queimou, substituída"), técnico, peças e custo. Todo o histórico fica no dispositivo.</p>
 <p><b>Ler QR Code</b>: aponte a câmera para a etiqueta (ou digite o patrimônio/série) — a ficha abre na hora para consultar ou registrar a manutenção.</p>
 <p><b>Alertas</b>: ao entrar no app, o painel avisa quantos dispositivos estão com preventiva vencida ou vencendo em 15 dias.</p>""",
 [("06_device_detail.jpeg", "Ficha do dispositivo"), ("07_maintenance.jpeg", "Registrar corretiva"), ("09_scan.jpeg", "Leitor de QR Code")]))
S.append(sec("6. Orçamentos",
 """<p>Crie orçamentos de <b>venda</b> ou <b>serviço</b>: selecione o cliente, adicione itens (descrição, quantidade, valor unitário, detalhes), desconto e impostos. Acompanhe o status: Rascunho, Pendente, Aprovado, Rejeitado, Concluído. Use <b>Imprimir</b> para gerar o PDF com a logo da empresa e enviar ao cliente.</p>""",
 [("10_quotes.jpeg", "Lista de orçamentos"), ("11_quote_editor.jpeg", "Editor de orçamento")]))
S.append(sec("7. Clientes",
 """<p>Cadastre nome, empresa, telefone, CNPJ/CPF, e-mail, endereço, <b>estado e cidade</b> (lista completa de municípios do Brasil — escolha o estado e as cidades são filtradas). Os clientes são vinculados a orçamentos, dispositivos, racks, topologias, plantas e servidores.</p>""",
 [("20_clients.jpeg", "Clientes")]))
S.append(sec("8. Infraestrutura — Racks",
 """<p>Monte racks de 6U a 50U. Toque em uma posição livre para adicionar um equipamento do catálogo: switch 8/24/48 portas, patch panel, guia de cabos, painel cego, roteador, firewall, servidor 1U/2U/4U, <b>servidor torre (bandeja)</b>, storage/NAS, NVR/DVR, nobreak, PDU, DIO, KVM, bandeja. Cada item é desenhado de forma realista com <b>LEDs de energia e atividade piscando</b> nos equipamentos ativos. Toque em um equipamento para editar identificação, altura ou remover. <b>Imprimir</b> gera o relatório do rack em PDF.</p>""",
 [("12_infra.jpeg", "Infraestrutura"), ("13_rack.jpeg", "Rack"), ("14_rack_picker.jpeg", "Catálogo de equipamentos")]))
S.append(sec("9. Infraestrutura — Topologia de rede",
 """<p>Diagrama estilo Packet Tracer. Use <b>Auto</b> para gerar automaticamente informando a quantidade de roteadores, switches, servidores, computadores, access points, impressoras e câmeras. Depois ajuste manualmente: <b>arraste</b> os dispositivos, toque em um dispositivo para editar (nome, tipo, IP, portas, local) ou <b>Conectar</b> (toque no destino para criar o cabo), toque em uma conexão para rotular (porta/VLAN) ou remover. Use pinça/botões para zoom. <b>Imprimir</b> exporta o diagrama e a tabela de dispositivos em PDF.</p>""",
 [("15_topology.jpeg", "Topologia gerada automaticamente")]))
S.append(sec("10. Infraestrutura — Plantas baixas",
 """<p>Escolha <b>enviar imagem</b> da planta (foto/arquivo) ou <b>desenhar</b> uma planta simples com cômodos retangulares. Ative <b>Adicionar ponto</b> e toque no local para marcar pontos de rede (RJ45), access points, câmeras, telefones, racks e tomadas. Toque em um ponto para identificar (ex.: patch panel/porta) ou remover.</p>""",
 [("16_floorplan.jpeg", "Planta desenhada com ponto de rede")]))
S.append(sec("11. Servidores e mapa",
 """<p>O mapa do Brasil mostra os estados coloridos por região; ao dar <b>zoom</b> (pinça ou botões) aparecem as cidades. Cada servidor é um ponto: <b>verde</b> online, <b>amarelo</b> instável, <b>vermelho</b> offline. Toque no ponto ou no card para ver status, latência, CPU/memória/disco (via agente) e os dados de acesso — <b>mascarados</b>; toque para revelar.</p>
 <p><b>Cadastro</b>: nome, host/IP, porta, cliente, função, <b>estado e cidade</b> (posiciona no mapa automaticamente; também é possível tocar no mapa), especificações e topologia vinculada. <b>Verificar</b> testa a conexão TCP e mede a latência.</p>
 <p><b>Agente</b>: botão na ficha do servidor — copie o script Linux ou Windows (já com a chave do servidor) e siga o guia de instalação do capítulo 13.</p>""",
 [("17_map.jpeg", "Mapa"), ("18_server_sheet.jpeg", "Ficha do servidor"), ("23_server_form.jpeg", "Cadastro com estado/cidade"), ("19_agent.jpeg", "Script do agente")]))
S.append(sec("12. Assinantes (administrador)",
 """<p>Lista todos os clientes que compraram o app: plano, valor pago, último pagamento, contrato (data e IP), receita total, quantidade de mensais e vitalícias. Contas mensais sem pagamento são <b>bloqueadas automaticamente</b>; você também pode <b>Bloquear/Desbloquear</b> manualmente.</p>""",
 [("21_subscribers.jpeg", "Assinantes")]))
S.append(f'<section><h2>13. Agente de monitoramento — instalação e portas</h2>{agent_html}</section>')

html = f"""<html><head><meta charset="utf-8"/><style>
@page {{ size: A4; margin: 16mm 14mm; }}
body{{font-family:Helvetica,Arial,sans-serif;color:#111;font-size:11.5px;line-height:1.45}}
.cover{{height:250mm;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;page-break-after:always}}
.cover h1{{font-size:40px;margin:0;letter-spacing:2px}} .cover h1 span{{color:#1E6FE8}}
.cover p{{color:#555;font-size:14px}}
h2{{font-size:17px;color:#1E6FE8;border-bottom:2px solid #1E6FE8;padding-bottom:4px;margin:0 0 8px}}
section{{page-break-before:always}} section:first-of-type{{page-break-before:auto}}
.row{{display:flex;gap:12px;align-items:flex-start}} .txt{{flex:1.2}} .figs{{flex:1;display:flex;flex-wrap:wrap;gap:8px;justify-content:center}}
figure{{margin:0;width:46%;text-align:center}} figure img{{width:100%;border:1px solid #ccc;border-radius:8px}}
figcaption{{font-size:9px;color:#666;margin-top:2px}}
.toc li{{margin:3px 0}} pre.md{{white-space:pre-wrap;font-family:Menlo,Consolas,monospace;font-size:9.5px;background:#f6f7fb;padding:10px;border-radius:6px}}
ul{{padding-left:16px}}
</style></head><body>
<div class="cover"><h1>N-<span>SECURITY</span></h1><p style="font-size:22px;color:#111;letter-spacing:4px">INFRAMANAGER</p><p>Manual do usuário · versão 1.0 · {datetime.date.today().strftime('%d/%m/%Y')}</p>
<p style="max-width:120mm">Gestão de infraestrutura de TI: inventário com etiquetas QR e manutenções, orçamentos, racks, topologias, plantas baixas, monitoramento de servidores e assinaturas.</p></div>
<section><h2>Sumário</h2><ol class="toc">
<li>Acesso e conta (login, cadastro, contrato, planos, biometria)</li><li>Painel inicial (Dashboard)</li><li>Configurações (tema, idioma, logo)</li>
<li>Dispositivos (inventário)</li><li>Ficha do dispositivo, etiqueta QR e manutenções</li><li>Orçamentos</li><li>Clientes</li>
<li>Racks</li><li>Topologia de rede</li><li>Plantas baixas</li><li>Servidores e mapa</li><li>Assinantes (administrador)</li><li>Agente de monitoramento — instalação e portas</li></ol></section>
{''.join(S)}
</body></html>"""
out_html = os.path.join(D, "manual-inframanager.html")
open(out_html, "w", encoding="utf-8").write(html)
pdf = os.path.join(D, "manual-inframanager.pdf")
subprocess.run(["google-chrome", "--headless=new", "--no-sandbox", "--disable-gpu", f"--print-to-pdf={pdf}", "--no-pdf-header-footer", "file://" + out_html], check=False, capture_output=True, timeout=120)
print(pdf, os.path.getsize(pdf) if os.path.exists(pdf) else "FAILED")
