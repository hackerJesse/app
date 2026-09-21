import React, { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/api";
import { Button, Card, Header, Input, Row, Screen, SectionTitle, Segmented, Select, notify } from "@/src/components/ui";
import { DEVICE_KINDS, Device, Maintenance } from "@/src/devices";
import { useList } from "@/src/hooks";
import { printHtml, sharePdf } from "@/src/pdf";
import { devicesReportHtml, inPeriod, serversReportHtml } from "@/src/reports";
import { fonts, makeStyles } from "@/src/theme";
import { Client, Server } from "@/src/types";

type Tab = "ativos" | "servidores";

export default function ReportsScreen() {
  const styles = useStyles();
  const [tab, setTab] = useState<Tab>("ativos");
  const clients = useList<Client>("clients");
  const devices = useList<Device>("devices");
  const servers = useList<Server>("servers");
  const maintenances = useQuery<Maintenance[]>({ queryKey: ["maintenances"], queryFn: () => api("/maintenances") });

  // filtros — ativos
  const [clientId, setClientId] = useState("");
  const [kind, setKind] = useState("");
  const [cFrom, setCFrom] = useState("");
  const [cTo, setCTo] = useState("");
  const [mFrom, setMFrom] = useState("");
  const [mTo, setMTo] = useState("");
  // filtros — servidores
  const [srvClient, setSrvClient] = useState("");
  const [mode, setMode] = useState<"resumo" | "completo">("completo");
  const [busy, setBusy] = useState(false);

  const clientName = (id: string) => clients.data?.find((c) => c.id === id)?.name;

  const filteredDevices = useMemo(
    () =>
      (devices.data ?? []).filter((d) => (!clientId || d.client_id === clientId) && (!kind || d.kind === kind) && inPeriod(d.created_at, { from: cFrom, to: cTo })),
    [devices.data, clientId, kind, cFrom, cTo],
  );
  const filteredMaint = useMemo(() => {
    const ids = new Set(filteredDevices.map((d) => d.id));
    return (maintenances.data ?? []).filter((m) => ids.has(m.device_id) && inPeriod(m.date, { from: mFrom, to: mTo }));
  }, [maintenances.data, filteredDevices, mFrom, mTo]);
  const filteredServers = useMemo(() => (servers.data ?? []).filter((s) => !srvClient || s.client_id === srvClient), [servers.data, srvClient]);

  const buildHtml = () =>
    tab === "ativos"
      ? devicesReportHtml({ devices: filteredDevices, maintenances: filteredMaint, created: { from: cFrom, to: cTo }, maint: { from: mFrom, to: mTo }, clientName: clientName(clientId), kind })
      : serversReportHtml(filteredServers, mode, clientName(srvClient));

  const run = async (share: boolean) => {
    setBusy(true);
    try {
      const html = buildHtml();
      const name = tab === "ativos" ? "relatorio-ativos.pdf" : `relatorio-servidores-${mode}.pdf`;
      if (share) await sharePdf(html, name);
      else await printHtml(html);
    } catch (e: any) {
      notify("Falha ao gerar relatório", e?.message);
    } finally {
      setBusy(false);
    }
  };

  const clientOptions = [{ value: "", label: "Todos os clientes" }, ...(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))];
  const prev = filteredMaint.filter((m) => m.kind === "preventiva").length;

  return (
    <Screen>
      <Header title="Relatórios" subtitle="Imprimir ou gerar PDF" back />
      <Segmented options={[{ value: "ativos" as Tab, label: "Ativos e manutenções" }, { value: "servidores" as Tab, label: "Servidores" }]} value={tab} onChange={setTab} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        {tab === "ativos" ? (
          <>
            <SectionTitle title="Filtros" />
            <Select label="Cliente" value={clientId} options={clientOptions} onChange={setClientId} testID="rep-client" />
            <Select label="Tipo de ativo" value={kind} options={[{ value: "", label: "Todos os tipos" }, ...DEVICE_KINDS.map((k) => ({ value: k.value, label: k.label }))]} onChange={setKind} testID="rep-kind" />
            <Text style={styles.label}>PERÍODO DE CADASTRO</Text>
            <Row gap={8}>
              <Input style={{ flex: 1 }} value={cFrom} onChangeText={setCFrom} placeholder="De (dd/mm/aaaa)" keyboardType="numbers-and-punctuation" testID="rep-created-from" />
              <Input style={{ flex: 1 }} value={cTo} onChangeText={setCTo} placeholder="Até (dd/mm/aaaa)" keyboardType="numbers-and-punctuation" testID="rep-created-to" />
            </Row>
            <Text style={styles.label}>PERÍODO DAS MANUTENÇÕES</Text>
            <Row gap={8}>
              <Input style={{ flex: 1 }} value={mFrom} onChangeText={setMFrom} placeholder="De (dd/mm/aaaa)" keyboardType="numbers-and-punctuation" testID="rep-maint-from" />
              <Input style={{ flex: 1 }} value={mTo} onChangeText={setMTo} placeholder="Até (dd/mm/aaaa)" keyboardType="numbers-and-punctuation" testID="rep-maint-to" />
            </Row>
            <Card style={{ gap: 4 }} testID="rep-summary">
              <Text style={styles.kpi}>{filteredDevices.length} ativo(s) · {filteredMaint.length} manutenção(ões)</Text>
              <Text style={styles.hint}>{prev} preventiva(s) · {filteredMaint.length - prev} corretiva(s)</Text>
            </Card>
          </>
        ) : (
          <>
            <SectionTitle title="Filtros" />
            <Select label="Cliente" value={srvClient} options={clientOptions} onChange={setSrvClient} testID="rep-srv-client" />
            <Select label="Formato" value={mode} options={[{ value: "completo", label: "Completo — com configurações e métricas" }, { value: "resumo", label: "Resumo — uma linha por servidor" }]} onChange={setMode} testID="rep-srv-mode" />
            <Card style={{ gap: 4 }} testID="rep-srv-summary">
              <Text style={styles.kpi}>{filteredServers.length} servidor(es)</Text>
              <Text style={styles.hint}>
                {filteredServers.filter((s) => s.status === "online").length} online · {filteredServers.filter((s) => s.status === "offline").length} offline
              </Text>
            </Card>
          </>
        )}
        <View style={{ height: 4 }} />
        <Row gap={8}>
          <Button title="Imprimir" icon="print-outline" onPress={() => run(false)} loading={busy} style={{ flex: 1 }} testID="rep-print" />
          <Button title="PDF" icon="download-outline" variant="secondary" onPress={() => run(true)} loading={busy} testID="rep-pdf" />
        </Row>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  label: { color: c.muted, fontFamily: fonts.displayMedium, fontSize: 12, letterSpacing: 1.2, marginTop: 4 },
  kpi: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 15 },
  hint: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
}));
