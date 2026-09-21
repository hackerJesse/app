import React, { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";

import { api } from "@/src/api";
import { useSettings } from "@/src/brand";
import { BrazilMap, serverUnstable } from "@/src/components/brazil-map";
import { AreaChart } from "@/src/components/charts";
import { Badge, Button, Card, Empty, Fab, Header, Icon, Row, Screen, Segmented, Sheet, notify } from "@/src/components/ui";
import { useList } from "@/src/hooks";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { useT, tr } from "@/src/i18n";
import { Server, Topology, fmtDate } from "@/src/types";

function mask(v: string) {
  if (!v) return "—";
  return v.replace(/[A-Za-z0-9]/g, "•");
}

export default function ServerMapScreen() {
  const styles = useStyles();
  const t = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const servers = useList<Server>("servers");
  const topos = useList<Topology>("topologies");
  const settings = useSettings();
  const warnMs = settings.data?.latency_warn_ms ?? 300;
  const [sel, setSel] = useState<Server | null>(null);
  const [reveal, setReveal] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentOs, setAgentOs] = useState<"linux" | "windows">("linux");

  const checkAll = useMutation({
    mutationFn: () => api<Server[]>("/servers/check-all", { method: "POST" }),
    onSuccess: (data) => {
      qc.setQueryData(["servers"], data);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const checkOne = useMutation({
    mutationFn: (id: string) => api<Server>(`/servers/${id}/check`, { method: "POST" }),
    onSuccess: (data) => {
      qc.setQueryData<Server[]>(["servers"], (old) => old?.map((s) => (s.id === data.id ? data : s)) ?? [data]);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setSel(data);
    },
  });
  const script = useQuery<{ script: string; agent_key: string; url: string }>({
    queryKey: ["agent-script", sel?.id, agentOs],
    queryFn: () => api(`/servers/${sel!.id}/agent-script?os=${agentOs}&base=${encodeURIComponent(process.env.EXPO_PUBLIC_BACKEND_URL ?? "")}`),
    enabled: !!sel && agentOpen,
  });

  const list = servers.data ?? [];
  const online = list.filter((s) => s.status === "online").length;
  const unstable = list.filter((s) => serverUnstable(s, warnMs)).length;
  const tone = (s: Server) => (s.status === "online" ? (serverUnstable(s, warnMs) ? "warning" : "success") : s.status === "offline" ? "error" : "neutral");
  const statusText = (s: Server) => (s.status === "unknown" ? "não verificado" : serverUnstable(s, warnMs) && s.status === "online" ? "instável" : s.status);
  const openServer = (s: Server) => {
    setReveal(false);
    setSel(s);
  };
  const topoName = (id?: string) => topos.data?.find((t) => t.id === id)?.name;
  const agentStale = (s: Server) => !s.metrics?.at || Date.now() - new Date(s.metrics.at).getTime() > 15 * 60 * 1000;

  return (
    <Screen>
      <Header
        title={t("servers")}
        subtitle={`${list.length} monitorados · ${online} online · ${unstable} instáveis`}
        right={<Button small title={tr("Verificar")} icon="pulse-outline" variant="ghost" onPress={() => checkAll.mutate()} loading={checkAll.isPending} testID="check-all" />}
      />
      <FlatList
        data={list}
        keyExtractor={(s) => s.id}
        onRefresh={servers.refetch}
        refreshing={servers.isFetching && !servers.isLoading}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View style={styles.mapBox}>
            <BrazilMap servers={list} onPinPress={openServer} selectedId={sel?.id} zoomable warnMs={warnMs} />
            <Text style={styles.hint}>{tr("Pinça para zoom · verde online · amarelo instável · vermelho offline")}</Text>
          </View>
        }
        ListEmptyComponent={
          servers.isLoading ? null : (
            <Empty icon="hardware-chip-outline" title={tr("Nenhum servidor")} hint={tr("Cadastre servidores com host/porta para monitorar o status no mapa.")} action={<Button title={tr("Novo servidor")} onPress={() => router.push("/server/new")} testID="empty-new-server" />} />
          )
        }
        renderItem={({ item: s }) => (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <Card onPress={() => openServer(s)} testID={`server-card-${s.id}`}>
              <Row>
                <View style={[styles.statusDot, { backgroundColor: tone(s) === "success" ? colors.success : tone(s) === "warning" ? colors.warning : tone(s) === "error" ? colors.error : colors.muted }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{s.name}</Text>
                  <Text style={styles.meta}>{[s.city, s.client_name, s.role].filter(Boolean).join(" · ") || "—"}</Text>
                  {s.metrics ? (
                    <Text style={styles.meta}>
                      CPU {s.metrics.cpu ?? "—"}% · RAM {s.metrics.mem ?? "—"}% · Disco {s.metrics.disk ?? "—"}%{agentStale(s) ? " · agente sem contato" : ""}
                    </Text>
                  ) : null}
                </View>
                {s.latency_ms != null ? <Text style={styles.latency}>{s.latency_ms} ms</Text> : null}
                <Badge text={statusText(s)} tone={tone(s)} />
              </Row>
            </Card>
          </View>
        )}
      />
      <Fab onPress={() => router.push("/server/new")} testID="fab-new-server" />

      <Sheet
        visible={!!sel && !agentOpen}
        onClose={() => setSel(null)}
        title={sel?.name ?? ""}
        footer={
          <Row gap={8}>
            <Button title={tr("Verificar")} icon="pulse-outline" variant="secondary" onPress={() => sel && checkOne.mutate(sel.id)} loading={checkOne.isPending} testID="check-one" />
            <Button title={tr("Agente")} icon="terminal-outline" variant="secondary" onPress={() => setAgentOpen(true)} testID="agent-open" />
            <Button title={tr("Editar")} icon="create-outline" style={{ flex: 1 }} onPress={() => { const id = sel?.id; setSel(null); if (id) router.push(`/server/${id}`); }} testID="server-edit" />
          </Row>
        }
      >
        {sel ? (
          <>
            <Row gap={8} style={{ flexWrap: "wrap" }}>
              <Badge text={statusText(sel)} tone={tone(sel)} />
              {sel.latency_ms != null ? <Badge text={`${sel.latency_ms} ms`} tone={sel.latency_ms > warnMs ? "warning" : "neutral"} /> : null}
              {sel.last_check ? <Text style={styles.meta}>Última verificação: {fmtDate(sel.last_check)} {new Date(sel.last_check).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Text> : null}
            </Row>

            {sel.metrics ? (
              <Card style={{ gap: 8 }} testID="server-metrics">
                <Text style={styles.secLabel}>RECURSOS (AGENTE{agentStale(sel) ? " · SEM CONTATO" : ""})</Text>
                <Meter label="CPU" value={sel.metrics.cpu} />
                <Meter label={tr("Memória")} value={sel.metrics.mem} />
                <Meter label={tr("Disco")} value={sel.metrics.disk} />
                <Text style={styles.meta}>
                  {[sel.metrics.hostname, sel.metrics.os, sel.metrics.uptime && `up ${sel.metrics.uptime}`].filter(Boolean).join(" · ")}
                </Text>
                {(sel.metrics_history?.length ?? 0) > 1 ? (
                  <>
                    <Text style={styles.secLabel}>{tr("CPU · HISTÓRICO")}</Text>
                    <AreaChart values={(sel.metrics_history ?? []).map((m) => m.cpu ?? 0)} height={60} />
                  </>
                ) : null}
              </Card>
            ) : (
              <Card>
                <Text style={styles.meta}>{tr("Sem dados de CPU/memória/disco. Instale o agente de monitoramento (botão \"Agente\").")}</Text>
              </Card>
            )}

            <Pressable onPress={() => setReveal((r) => !r)} style={styles.secure} testID="reveal-toggle">
              <Row>
                <Icon name={reveal ? "eye-off-outline" : "eye-outline"} size={18} color={colors.brandPrimary} />
                <Text style={styles.secureTitle}>{reveal ? tr("OCULTAR DADOS SENSÍVEIS") : tr("TOQUE PARA REVELAR DADOS DE ACESSO")}</Text>
              </Row>
              <Spec label={tr("Host / Domínio")} value={reveal ? sel.host : mask(sel.host)} testID="spec-host" />
              <Spec label={tr("Porta")} value={reveal ? String(sel.port) : mask(String(sel.port))} />
              {sel.notes ? <Spec label={tr("Escopo / Rede")} value={reveal ? sel.notes : mask(sel.notes)} /> : null}
            </Pressable>
            <View style={styles.specGrid}>
              <Spec label={tr("Cliente")} value={sel.client_name || "—"} />
              <Spec label={tr("Cidade")} value={sel.city || "—"} />
              <Spec label={tr("Função")} value={sel.role || "—"} />
              <Spec label={tr("Sistema")} value={sel.os || "—"} />
              <Spec label="CPU" value={sel.cpu || "—"} />
              <Spec label="RAM" value={sel.ram || "—"} />
              <Spec label={tr("Disco")} value={sel.disk || "—"} />
            </View>
            {sel.topology_id ? (
              <Button title={`Topologia: ${topoName(sel.topology_id) ?? "abrir"}`} icon="git-network-outline" variant="ghost" onPress={() => { const tid = sel.topology_id; setSel(null); router.push(`/topology/${tid}`); }} testID="server-topology" />
            ) : null}
          </>
        ) : null}
      </Sheet>

      <Sheet
        visible={agentOpen}
        onClose={() => setAgentOpen(false)}
        title={tr("Agente de monitoramento")}
        footer={
          <Button
            title={tr("Copiar script")}
            icon="copy-outline"
            testID="agent-copy"
            onPress={async () => {
              if (script.data?.script) {
                await Clipboard.setStringAsync(script.data.script);
                notify(tr("Script copiado"), tr("Cole no servidor conforme as instruções."));
              }
            }}
          />
        }
      >
        <Segmented options={[{ value: "linux", label: "Linux" }, { value: "windows", label: "Windows" }]} value={agentOs} onChange={setAgentOs} />
        <Text style={styles.meta}>
          {agentOs === "linux"
            ? "1) Salve o script em /opt/nsecurity/agent.sh e dê permissão: chmod +x agent.sh\n2) Agende no cron a cada 5 min: */5 * * * * /opt/nsecurity/agent.sh\n3) Firewall: permitir SAÍDA TCP 443 (HTTPS) para o endereço do app. Para o teste de latência externo, permitir ENTRADA na porta cadastrada (ex.: 22, 443, 3389) a partir da internet."
            : "1) Salve como C:\\NSecurity\\agent.ps1\n2) Agendador de Tarefas: executar a cada 5 min → powershell.exe -ExecutionPolicy Bypass -File C:\\NSecurity\\agent.ps1\n3) Firewall do Windows: permitir SAÍDA TCP 443 (HTTPS) para o app. Para o teste de latência externo, liberar ENTRADA na porta cadastrada (ex.: 3389, 443) a partir da internet."}
        </Text>
        <Text style={styles.secLabel}>{tr("CHAVE DO AGENTE")}</Text>
        <Text selectable style={styles.code} testID="agent-key">
          {script.data?.agent_key ?? "..."}
        </Text>
        <Text style={styles.secLabel}>{tr("SCRIPT")}</Text>
        <Text selectable style={styles.code}>
          {script.isLoading ? "Gerando..." : script.data?.script ?? ""}
        </Text>
      </Sheet>
    </Screen>
  );
}

function Meter({ label, value }: { label: string; value?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const v = Math.max(0, Math.min(100, value ?? 0));
  const color = v > 90 ? colors.error : v > 75 ? colors.warning : colors.brandPrimary;
  return (
    <View style={{ gap: 3 }}>
      <Row>
        <Text style={[styles.meta, { flex: 1 }]}>{label}</Text>
        <Text style={[styles.meta, { color: colors.onSurface }]}>{value != null ? `${v}%` : "—"}</Text>
      </Row>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${v}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function Spec({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.spec}>
      <Text style={styles.specLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.specValue} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  mapBox: { margin: 12, borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.surfaceSecondary, padding: 6 },
  hint: { color: c.muted, fontFamily: fonts.text, fontSize: 10, textAlign: "center", paddingBottom: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  name: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 16 },
  meta: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
  latency: { color: c.onSurfaceTertiary, fontFamily: fonts.displayMedium, fontSize: 13 },
  secLabel: { color: c.muted, fontFamily: fonts.displayMedium, fontSize: 11, letterSpacing: 1 },
  secure: { borderWidth: 1, borderColor: c.brandPrimary, borderRadius: 10, padding: 12, gap: 8, backgroundColor: c.surfaceTertiary },
  secureTitle: { color: c.brandPrimary, fontFamily: fonts.displayMedium, fontSize: 12, letterSpacing: 1 },
  specGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  spec: { minWidth: "45%", flexGrow: 1, gap: 2 },
  specLabel: { color: c.muted, fontFamily: fonts.text, fontSize: 10, letterSpacing: 0.8 },
  specValue: { color: c.onSurface, fontFamily: fonts.text, fontSize: 14 },
  meterTrack: { height: 6, borderRadius: 3, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  meterFill: { height: 6, borderRadius: 3 },
  code: { color: c.onSurface, fontFamily: fonts.text, fontSize: 11, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10 },
}));
