import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import Svg, { Path, Rect } from "react-native-svg";

import { api, fileUrl } from "@/src/api";
import { Badge, Button, Card, Header, Icon, IconButton, Input, Row, Screen, Select, Sheet, StickyBar, confirmAsync, notify } from "@/src/components/ui";
import { DEVICE_KIND_MAP, DEVICE_STATUS, Device, Maintenance, fmtDateTime, labelHtml, preventiveBadge, qrPayload } from "@/src/devices";
import { useItem, useRemove } from "@/src/hooks";
import { printLabel as printLabelPdf, sharePdf } from "@/src/pdf";
import { qrPath } from "@/src/qr";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { fmtBRL, fmtDate } from "@/src/types";

function nowLocalInput() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function parseLocalInput(v: string): string {
  const m = v.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return new Date().toISOString();
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  return d.toISOString();
}

export default function DeviceDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { item: d, isLoading } = useItem<Device>("devices", id);
  const remove = useRemove("devices");
  const maint = useQuery<Maintenance[]>({ queryKey: ["maintenances", id], queryFn: () => api(`/devices/${id}/maintenances`), enabled: !!id });
  const [sheet, setSheet] = useState<Partial<Maintenance> | null>(null);
  const [dateInput, setDateInput] = useState("");
  const [costInput, setCostInput] = useState("0");
  const [qrOpen, setQrOpen] = useState(false);

  const addMaint = useMutation({
    mutationFn: (body: Partial<Maintenance>) => api<Maintenance>(`/devices/${id}/maintenances`, { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenances", id] });
      qc.invalidateQueries({ queryKey: ["devices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const delMaint = useMutation({
    mutationFn: (mid: string) => api(`/maintenances/${mid}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenances", id] }),
  });

  if (isLoading || !d) return <Screen><Header title="Dispositivo" back /></Screen>;

  const kind = DEVICE_KIND_MAP[d.kind] ?? DEVICE_KIND_MAP.outro;
  const pb = preventiveBadge(d);
  const qr = qrPath(qrPayload(d));

  const openMaint = (k: "preventiva" | "corretiva") => {
    setDateInput(nowLocalInput());
    setCostInput("0");
    setSheet({ kind: k, description: "", technician: "", parts: "" });
  };

  const saveMaint = async () => {
    if (!sheet) return;
    if (sheet.kind === "corretiva" && !sheet.description?.trim()) {
      notify("Descreva o que aconteceu");
      return;
    }
    try {
      await addMaint.mutateAsync({ ...sheet, date: parseLocalInput(dateInput), cost: parseFloat(costInput.replace(",", ".")) || 0 });
      setSheet(null);
    } catch (e: any) {
      notify("Erro ao registrar", e?.message);
    }
  };

  const printLabel = async (share: boolean) => {
    try {
      const html = labelHtml(d);
      if (share) await sharePdf(html, `etiqueta-${d.asset_tag || d.id.slice(0, 8)}.pdf`, true);
      else await printLabelPdf(html);
    } catch (e: any) {
      notify("Falha ao gerar etiqueta", e?.message);
    }
  };

  const doDelete = async () => {
    if (!(await confirmAsync("Excluir dispositivo", `Remover ${d.name} do inventário?`))) return;
    await remove.mutateAsync(d.id);
    router.back();
  };

  const specs = kind.specs.filter((f) => d.specs?.[f.key]);

  return (
    <Screen>
      <Header
        title={d.name}
        subtitle={`${kind.label}${d.asset_tag ? ` · Pat. ${d.asset_tag}` : ""}`}
        back
        right={
          <Row gap={0}>
            <IconButton name="create-outline" onPress={() => router.push({ pathname: "/device/form", params: { id: d.id } })} testID="device-edit" />
            <IconButton name="trash-outline" color={colors.error} onPress={doDelete} testID="device-delete" />
          </Row>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        <Row gap={12} style={{ alignItems: "flex-start" }}>
          {d.photo_path ? (
            <Image source={{ uri: fileUrl(d.photo_path) }} style={styles.photo} contentFit="cover" />
          ) : (
            <View style={[styles.photo, { alignItems: "center", justifyContent: "center" }]}>
              <Icon name={kind.icon as any} size={36} color={colors.brandPrimary} />
            </View>
          )}
          <View style={{ flex: 1, gap: 6 }}>
            <Row gap={6} style={{ flexWrap: "wrap" }}>
              <Badge text={DEVICE_STATUS.find((s) => s.value === d.status)?.label ?? d.status} tone={d.status === "ativo" ? "success" : d.status === "manutencao" ? "warning" : "neutral"} />
              {pb ? <Badge text={pb.text} tone={pb.tone} /> : <Badge text="Sem preventiva" tone="neutral" />}
            </Row>
            <Info label="Setor" value={d.sector} />
            <Info label="Nº de série" value={d.serial} />
            <Info label="Marca / modelo" value={[d.brand, d.model].filter(Boolean).join(" ")} />
            <Info label="Cliente" value={d.client_name} />
          </View>
        </Row>

        <Row gap={8}>
          <Button title="Etiqueta" icon="pricetag-outline" onPress={() => printLabel(false)} style={{ flex: 1 }} testID="print-label" />
          <Button title="PDF" icon="download-outline" variant="secondary" onPress={() => printLabel(true)} testID="label-pdf" />
          <Button title="QR" icon="qr-code-outline" variant="secondary" onPress={() => setQrOpen(true)} testID="show-qr" />
        </Row>

        <Text style={styles.section}>CONFIGURAÇÃO</Text>
        <Card style={{ gap: 6 }}>
          {specs.length === 0 ? <Text style={styles.hint}>Nenhuma configuração informada.</Text> : null}
          {specs.map((f) => (
            <Row key={f.key}>
              <Text style={styles.specLabel}>{f.label}</Text>
              <Text style={styles.specValue}>{d.specs[f.key]}</Text>
            </Row>
          ))}
          {d.notes ? <Text style={[styles.hint, { marginTop: 4 }]}>{d.notes}</Text> : null}
        </Card>

        <Text style={styles.section}>MANUTENÇÃO PREVENTIVA</Text>
        <Card style={{ gap: 4 }}>
          <Row>
            <Text style={styles.specLabel}>Periodicidade</Text>
            <Text style={styles.specValue}>{d.preventive_months ? `a cada ${d.preventive_months} ${d.preventive_months === 1 ? "mês" : "meses"}` : "não definida"}</Text>
          </Row>
          <Row>
            <Text style={styles.specLabel}>Última realizada</Text>
            <Text style={styles.specValue}>{d.last_preventive ? fmtDate(d.last_preventive) : "nunca (conta desde o cadastro)"}</Text>
          </Row>
          <Row>
            <Text style={styles.specLabel}>Próxima</Text>
            <Text style={[styles.specValue, d.preventive_state === "vencida" && { color: colors.error }]}>{d.next_preventive ? fmtDate(d.next_preventive) : "—"}</Text>
          </Row>
        </Card>

        <Row style={{ justifyContent: "space-between" }}>
          <Text style={styles.section}>HISTÓRICO ({maint.data?.length ?? 0})</Text>
        </Row>
        {(maint.data ?? []).length === 0 ? <Text style={styles.hint}>Nenhuma manutenção registrada. Use os botões abaixo para registrar.</Text> : null}
        {(maint.data ?? []).map((m) => (
          <Card key={m.id} testID={`maint-${m.id}`}>
            <Row style={{ alignItems: "flex-start" }}>
              <View style={[styles.dot, { backgroundColor: m.kind === "preventiva" ? colors.success : colors.warning }]} />
              <View style={{ flex: 1, gap: 2 }}>
                <Row>
                  <Badge text={m.kind} tone={m.kind === "preventiva" ? "success" : "warning"} />
                  <Text style={styles.hint}>{fmtDateTime(m.date)}</Text>
                </Row>
                <Text style={styles.maintDesc}>{m.description || (m.kind === "preventiva" ? "Preventiva realizada" : "—")}</Text>
                <Text style={styles.hint}>{[m.technician && `Téc.: ${m.technician}`, m.parts && `Peças: ${m.parts}`, m.cost ? `Custo: ${fmtBRL(m.cost)}` : ""].filter(Boolean).join(" · ")}</Text>
              </View>
              <IconButton name="close" size={16} color={colors.muted} onPress={async () => (await confirmAsync("Remover registro", "Excluir este registro de manutenção?")) && delMaint.mutate(m.id)} />
            </Row>
          </Card>
        ))}
      </ScrollView>

      <StickyBar>
        <Button title="Preventiva feita" icon="checkmark-done-outline" variant="secondary" onPress={() => openMaint("preventiva")} style={{ flex: 1 }} testID="add-preventive" />
        <Button title="Corretiva" icon="build-outline" onPress={() => openMaint("corretiva")} style={{ flex: 1 }} testID="add-corrective" />
      </StickyBar>

      <Sheet visible={!!sheet} onClose={() => setSheet(null)} title={sheet?.kind === "preventiva" ? "Registrar preventiva" : "Registrar corretiva"} footer={<Button title="Registrar" onPress={saveMaint} loading={addMaint.isPending} testID="maint-save" />}>
        {sheet ? (
          <>
            <Select label="Tipo" value={sheet.kind ?? "corretiva"} options={[{ value: "preventiva", label: "Preventiva (limpeza / revisão)" }, { value: "corretiva", label: "Corretiva (defeito / reparo)" }]} onChange={(v) => setSheet({ ...sheet, kind: v as any })} />
            <Input label="Data e hora" value={dateInput} onChangeText={setDateInput} placeholder="dd/mm/aaaa hh:mm" testID="maint-date" />
            <Input label={sheet.kind === "preventiva" ? "O que foi feito" : "O que aconteceu / o que foi feito *"} value={sheet.description} onChangeText={(v) => setSheet({ ...sheet, description: v })} multiline placeholder={sheet.kind === "preventiva" ? "Limpeza interna completa, troca de pasta térmica..." : "Fonte queimou; substituída por fonte 500W..."} testID="maint-desc" />
            <Row gap={8}>
              <Input style={{ flex: 1 }} label="Técnico" value={sheet.technician} onChangeText={(v) => setSheet({ ...sheet, technician: v })} placeholder="Nome" />
              <Input style={{ flex: 1 }} label="Custo (R$)" value={costInput} onChangeText={setCostInput} keyboardType="decimal-pad" />
            </Row>
            <Input label="Peças substituídas" value={sheet.parts} onChangeText={(v) => setSheet({ ...sheet, parts: v })} placeholder="Fonte ATX 500W" />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={qrOpen} onClose={() => setQrOpen(false)} title="QR Code do dispositivo">
        <View style={{ alignItems: "center", gap: 8 }}>
          <View style={styles.qrBox} testID="qr-preview">
            <Svg width={220} height={220} viewBox={`0 0 ${qr.size} ${qr.size}`}>
              <Rect width={qr.size} height={qr.size} fill="#FFFFFF" />
              <Path d={qr.path} fill="#000000" />
            </Svg>
          </View>
          <Text style={styles.hint}>{qrPayload(d)}</Text>
          <Text style={[styles.hint, { textAlign: "center" }]}>Leia este código pelo app (botão QR na aba Dispositivos) para abrir a ficha e registrar manutenções.</Text>
        </View>
      </Sheet>
    </Screen>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  const styles = useStyles();
  if (!value) return null;
  return (
    <Text style={styles.info}>
      <Text style={styles.infoLabel}>{label}: </Text>
      {value}
    </Text>
  );
}

const useStyles = makeStyles((c) => ({
  photo: { width: 120, height: 120, borderRadius: 4, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
  info: { color: c.onSurface, fontFamily: fonts.text, fontSize: 13 },
  infoLabel: { color: c.muted },
  section: { color: c.muted, fontFamily: fonts.displayMedium, fontSize: 13, letterSpacing: 1.2, marginTop: 4 },
  hint: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
  specLabel: { color: c.muted, fontFamily: fonts.text, fontSize: 12, width: 130 },
  specValue: { color: c.onSurface, fontFamily: fonts.text, fontSize: 13, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  maintDesc: { color: c.onSurface, fontFamily: fonts.text, fontSize: 14 },
  qrBox: { padding: 12, backgroundColor: "#FFFFFF", borderRadius: 4 },
}));
