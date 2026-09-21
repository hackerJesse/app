# Agente de Monitoramento — N-Security InfraManager

O agente é um script leve que roda **dentro do servidor monitorado** e envia, a cada 5 minutos, o uso de **CPU, memória e disco**, o tempo ligado (uptime), o hostname e o sistema operacional para o InfraManager. Não abre portas no servidor: a comunicação é **de saída (outbound)**, via HTTPS.

## Como obter o script
1. No app, abra **Servidores** → toque no servidor → botão **Agente**.
2. Escolha **Linux** ou **Windows** e toque em **Copiar script**. O script já vem com a **chave do agente** (única por servidor) e o endereço do app.
3. Se a chave for exposta, edite o servidor e salve novamente para manter, ou exclua e recadastre o servidor para gerar uma nova chave.

## Instalação — Linux (Ubuntu, Debian, CentOS, Rocky, etc.)
```bash
sudo mkdir -p /opt/nsecurity
sudo nano /opt/nsecurity/agent.sh        # cole o script copiado do app
sudo chmod +x /opt/nsecurity/agent.sh
/opt/nsecurity/agent.sh                  # teste manual: deve responder {"ok":true,...}
# agendar a cada 5 minutos
( sudo crontab -l 2>/dev/null; echo "*/5 * * * * /opt/nsecurity/agent.sh >/dev/null 2>&1" ) | sudo crontab -
```
Requisitos: `curl`, `top`, `free`, `df` (já presentes na maioria das distribuições).

## Instalação — Windows Server / Windows 10-11
1. Crie a pasta `C:\NSecurity` e salve o script como `C:\NSecurity\agent.ps1`.
2. Teste no PowerShell (como administrador):
   `powershell.exe -ExecutionPolicy Bypass -File C:\NSecurity\agent.ps1`
3. Agendar (Agendador de Tarefas ou comando abaixo, a cada 5 minutos):
```powershell
schtasks /Create /SC MINUTE /MO 5 /TN "NSecurity Agent" /RU SYSTEM ^
  /TR "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\NSecurity\agent.ps1"
```

## Portas de firewall
| Direção | Porta / Protocolo | Destino | Para que serve |
|---|---|---|---|
| **Saída** (obrigatória) | TCP **443** (HTTPS) | endereço do app InfraManager | Envio das métricas pelo agente |
| **Entrada** (opcional) | porta cadastrada no servidor (ex.: **443**, **3389** RDP, **22** SSH, **80**) | a partir da internet / IP do app | Teste de latência/online feito pelo app ("Verificar") |

- Sem a porta de **saída 443**, o agente não envia dados (o servidor aparece com "agente sem contato").
- Sem a porta de **entrada**, o botão **Verificar** mostrará o servidor como *offline*, mesmo com o agente funcionando. Nesse caso, use os dados do agente como referência de disponibilidade.
- Em roteadores/firewalls de borda (Mikrotik, pfSense, Fortigate, etc.), crie o redirecionamento (NAT) da porta de entrada para o IP interno do servidor e restrinja a origem quando possível.

## Regras de instabilidade
Um servidor é marcado como **instável** quando:
- está **offline** no teste de conexão; ou
- a latência é maior que o limite configurado (padrão **300 ms**, ajustável em **Configurações**); ou
- CPU, memória ou disco acima de **90%** (dados do agente); ou
- o agente ficou **mais de 15 minutos** sem enviar dados (indicado como "agente sem contato").

## Segurança
- A chave do agente identifica o servidor e só permite **enviar** métricas; não dá acesso a nenhum dado do app.
- O envio é HTTPS. Os dados de acesso (host, porta, escopo de rede) ficam mascarados no app e exigem toque para revelar.
