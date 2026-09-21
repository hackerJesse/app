import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { RackFace } from "@/src/components/rack-face";
import { Button, Header, Icon, IconButton, Input, Row, Screen, Select, Sheet, StickyBar, confirmAsync, notify } from "@/src/components/ui";
import { useItem, useList, useRemove, useSave } from "@/src/hooks";
import { canSharePdf, printHtml, sharePdf } from "@/src/pdf";
import { RACK_CATALOG, RACK_KIND_MAP, RACK_SIZES, rackHtml, slotFits, slotRange } from "@/src/rack";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { Client, Rack, RackSlot, Server } from "@/src/types";
import { useSettings } from "@/src/brand";
import { serverUnstable } from "@/src/components/brazil-map";
import type { LedStatus } from "@/src/components/rack-face";
import { tr } from "@/src/i18n";

const ROW_H = 30;
const EMPTY: Rack = { id: "", name: "", client_id: "", client_name: "", size_u: 48, location: "", slots: [] };

type RowData = { u: number; slot?: RackSlot; idx?: number };

export default function RackBuilder() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const { item, isLoading } = useItem<Rack>("racks", isNew ? undefined : id);
  const clients = useList<Client>("clients");
  const servers = useList<Server>("servers");
  const appSettings = useSettings();
  const ledFor = (slot: RackSlot): LedStatus => {
    const srv = servers.data?.find((x) => x.id === slot.server_id);
    if (!srv) return null;
    if (srv.status === "offline") return "offline";
    if (serverUnstable(srv, appSettings.data?.latency_warn_ms ?? 300)) return "unstable";
    return srv.status === "online" ? "online" : null;
  };
  const save = useSave<Rack>("racks");
  const remove = useRemove("racks");

  const [rack, setRack] = useState<Rack>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [settings, setSettings] = useState(isNew);
  const [picker, setPicker] = useState<{ u: number; idx: number; slot: RackSlot } | null>(null);
  const [frameW, setFrameW] = useState(0);

  useEffect(() => {
    if (item) setRack(item);
  }, [item]);

  const patch = (p: Partial<Rack>) => {
    setRack((r) => ({ ...r, ...p }));
    setDirty(true);
  };

  const rows = useMemo<RowData[]>(() => {
    const byTop = new Map<number, { slot: RackSlot; idx: number }>();
    const covered = new Set<number>();
    rack.slots.forEach((s, idx) => {
      const r = slotRange(s);
      byTop.set(r.top, { slot: s, idx });
      for (let u = r.bottom; u <= r.top; u++) covered.add(u);
    });
    const out: RowData[] = [];
    for (let u = rack.size_u; u >= 1; u--) {
      const top = byTop.get(u);
      if (top) out.push({ u, slot: top.slot, idx: top.idx });
      else if (!covered.has(u)) out.push({ u });
    }
    return out;
  }, [rack.slots, rack.size_u]);

  const used = rack.slots.reduce((s, x) => s + x.u_size, 0);

  const openEmpty = (u: number) => {
    const first = RACK_CATALOG[0];
    setPicker({ u, idx: -1, slot: { u_start: u, u_size: first.size, kind: first.kind, label: "", detail: "" } });
  };
  const openSlot = (slot: RackSlot, idx: number) => setPicker({ u: slot.u_start, idx, slot: { ...slot } });

  const pickKind = (kind: string) => {
    if (!picker) return;
    const meta = RACK_KIND_MAP[kind];
    setPicker({ ...picker, slot: { ...picker.slot, kind, u_size: meta.size } });
  };

  const confirmSlot = () => {
    if (!picker) return;
    let candidate = { ...picker.slot };
    // Try to fit downwards from tapped U, falling back to growing upwards.
    if (!slotFits(rack.slots, candidate, rack.size_u, picker.idx)) {
      const alt = { ...candidate, u_start: candidate.u_start - candidate.u_size + 1 };
      if (slotFits(rack.slots, alt, rack.size_u, picker.idx)) candidate = alt;
      else {
        notify(tr("Espaço insuficiente"), `Não há ${candidate.u_size}U livres nessa posição.`);
        return;
      }
    }
    const slots = [...rack.slots];
    if (picker.idx === -1) slots.push(candidate);
    else slots[picker.idx] = candidate;
    patch({ slots });
    setPicker(null);
  };

  const removeSlot = () => {
    if (!picker || picker.idx === -1) return;
    patch({ slots: rack.slots.filter((_, i) => i !== picker.idx) });
    setPicker(null);
  };

  const doSave = async () => {
    if (!rack.name.trim()) {
      setSettings(true);
      notify(tr("Informe o nome do rack"));
      return;
    }
    try {
      const body: any = { ...rack };
      if (isNew) delete body.id;
      const saved = await save.mutateAsync(body);
      setDirty(false);
      setSettings(false);
      if (isNew) router.replace(`/rack/${saved.id}`);
    } catch (e: any) {
      notify(tr("Erro ao salvar"), e?.message);
    }
  };

  const doDelete = async () => {
    if (!(await confirmAsync(tr("Excluir rack"), tr("Esta ação não pode ser desfeita.")))) return;
    await remove.mutateAsync(rack.id);
    router.back();
  };

  const exportPdf = async (share: boolean) => {
    try {
      const html = rackHtml(rack);
      if (share) await sharePdf(html, `${rack.name || "rack"}.pdf`);
      else await printHtml(html);
    } catch (e: any) {
      notify(tr("Falha ao gerar PDF"), e?.message);
    }
  };

  const changeSize = (size: number) => {
    const overflow = rack.slots.some((s) => slotRange(s).top > size);
    if (overflow) {
      notify(tr("Rack ocupado acima do novo tamanho"), tr("Remova os equipamentos das posições superiores antes de reduzir."));
      return;
    }
    patch({ size_u: size });
  };

  if (!isNew && isLoading) return <Screen><Header title={tr("Rack")} back /></Screen>;

  return (
    <Screen>
      <Header
        title={rack.name || "Novo rack"}
        subtitle={`${rack.size_u}U · ${used}U ocupados · ${rack.size_u - used}U livres`}
        back
        right={
          <Row gap={0}>
            <IconButton name="settings-outline" onPress={() => setSettings(true)} testID="rack-settings" />
            {!isNew ? <IconButton name="trash-outline" color={colors.error} onPress={doDelete} testID="rack-delete" /> : null}
          </Row>
        }
      />
      <View style={styles.rackFrame} onLayout={(e) => setFrameW(e.nativeEvent.layout.width)}>
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.u)}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item: r }) => {
            if (r.slot) {
              const meta = RACK_KIND_MAP[r.slot.kind] ?? RACK_KIND_MAP.generic;
              return (
                <Pressable testID={`rack-slot-${r.slot.u_start}`} onPress={() => openSlot(r.slot!, r.idx!)} style={[styles.row, { height: ROW_H * r.slot.u_size }]}>
                  <View style={styles.rail}>
                    <Text style={styles.uText}>{r.u}</Text>
                    {r.slot.u_size > 1 ? <Text style={styles.uTextSmall}>{r.slot.u_start}</Text> : null}
                  </View>
                  <View style={{ flex: 1, marginVertical: 1 }}>
                    {frameW > 0 ? <RackFace kind={r.slot.kind} uSize={r.slot.u_size} label={r.slot.label || meta.label} width={frameW - 72} height={ROW_H * r.slot.u_size - 2} status={ledFor(r.slot)} /> : null}
                  </View>
                  <View style={styles.rail}>
                    <Text style={styles.uText}>{r.u}</Text>
                  </View>
                </Pressable>
              );
            }
            return (
              <Pressable testID={`rack-empty-${r.u}`} onPress={() => openEmpty(r.u)} style={[styles.row, { height: ROW_H }]}>
                <View style={styles.rail}>
                  <Text style={styles.uText}>{r.u}</Text>
                </View>
                <View style={styles.emptySlot}>
                  <View style={styles.hole} />
                  <Text style={styles.emptyText}>{tr("1U livre")}</Text>
                  <View style={styles.hole} />
                </View>
                <View style={styles.rail}>
                  <Text style={styles.uText}>{r.u}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>

      <StickyBar>
        <Button title={dirty || isNew ? tr("Salvar") : tr("Salvo")} icon="save-outline" onPress={doSave} loading={save.isPending} style={{ flex: 1 }} disabled={!dirty && !isNew} testID="rack-save" />
        <Button title={tr("Imprimir")} icon="print-outline" variant="secondary" onPress={() => exportPdf(false)} testID="rack-print" />
        {canSharePdf ? <Button title={tr("PDF")} icon="share-outline" variant="secondary" onPress={() => exportPdf(true)} /> : null}
      </StickyBar>

      {/* Settings sheet */}
      <Sheet visible={settings} onClose={() => setSettings(false)} title={tr("Configurações do rack")} footer={<Button title={tr("Aplicar")} onPress={() => (rack.name.trim() ? setSettings(false) : notify(tr("Informe o nome do rack")))} testID="rack-settings-apply" />}>
        <Input label={tr("Nome *")} value={rack.name} onChangeText={(v) => patch({ name: v })} placeholder={tr("Rack principal - CPD")} testID="rack-name" />
        <Select
          label={tr("Cliente")}
          value={rack.client_id ?? ""}
          options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          onChange={(v) => patch({ client_id: v, client_name: clients.data?.find((c) => c.id === v)?.name ?? "" })}
          testID="rack-client"
        />
        <Input label={tr("Localização")} value={rack.location} onChangeText={(v) => patch({ location: v })} placeholder={tr("Sala técnica, 2º andar")} />
        <Select
          label={tr("Tamanho (U)")}
          value={String(rack.size_u)}
          options={RACK_SIZES.map((s) => ({ value: String(s), label: `${s}U` }))}
          onChange={(v) => changeSize(Number(v))}
          testID="rack-size"
        />
      </Sheet>

      {/* Component picker sheet */}
      <Sheet
        visible={!!picker}
        onClose={() => setPicker(null)}
        title={picker?.idx === -1 ? `Adicionar na posição ${picker?.u}U` : `Editar equipamento`}
        footer={
          <Row gap={8}>
            {picker && picker.idx !== -1 ? <Button title={tr("Remover")} variant="danger" onPress={removeSlot} testID="slot-remove" /> : null}
            <Button title={tr("Confirmar")} onPress={confirmSlot} style={{ flex: 1 }} testID="slot-confirm" />
          </Row>
        }
      >
        {picker ? (
          <>
            <Text style={styles.sheetLabel}>{tr("EQUIPAMENTO")}</Text>
            <View style={styles.kindGrid}>
              {RACK_CATALOG.map((k) => {
                const active = k.kind === picker.slot.kind;
                return (
                  <Pressable key={k.kind} testID={`kind-${k.kind}`} onPress={() => pickKind(k.kind)} style={[styles.kind, active && styles.kindActive]}>
                    <Icon name={k.icon as any} size={18} color={active ? colors.brandPrimary : colors[k.colorKey]} />
                    <Text style={[styles.kindText, active && { color: colors.onBrandTertiary }]} numberOfLines={2}>
                      {tr(k.label)}
                    </Text>
                    <Text style={styles.kindSize}>{k.size}U</Text>
                  </Pressable>
                );
              })}
            </View>
            <Row gap={8}>
              <Input style={{ flex: 1 }} label={tr("Identificação")} value={picker.slot.label} onChangeText={(v) => setPicker({ ...picker, slot: { ...picker.slot, label: v } })} placeholder="SW-CORE-01" testID="slot-label" />
              <View style={{ width: 120 }}>
                <Select
                  label={tr("Altura")}
                  value={String(picker.slot.u_size)}
                  options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n}U` }))}
                  onChange={(v) => setPicker({ ...picker, slot: { ...picker.slot, u_size: Number(v) } })}
                  testID="slot-size"
                />
              </View>
            </Row>
            <Input label={tr("Detalhes")} value={picker.slot.detail} onChangeText={(v) => setPicker({ ...picker, slot: { ...picker.slot, detail: v } })} placeholder={tr("Modelo, VLANs, observações")} />
            <Select
              label={tr("Vincular a servidor monitorado (LED de status)")}
              value={picker.slot.server_id ?? ""}
              options={[{ value: "", label: "Sem vínculo (LED verde padrão)" }, ...(servers.data ?? []).map((sv) => ({ value: sv.id, label: sv.name, hint: `${sv.status}${sv.latency_ms != null ? ` · ${sv.latency_ms} ms` : ""}` }))]}
              onChange={(v) => setPicker({ ...picker, slot: { ...picker.slot, server_id: v } })}
              testID="slot-server"
            />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  rackFrame: { flex: 1, marginHorizontal: 12, marginTop: 8, marginBottom: 4, backgroundColor: c.rackRail, borderWidth: 2, borderColor: c.borderStrong, borderRadius: 4 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.border },
  rail: { width: 34, alignItems: "center", justifyContent: "center", backgroundColor: c.rackRail },
  uText: { color: c.muted, fontFamily: fonts.displayMedium, fontSize: 11 },
  uTextSmall: { color: c.muted, fontFamily: fonts.text, fontSize: 9, marginTop: 2 },
  emptySlot: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, backgroundColor: c.surface },
  emptyText: { color: c.divider, fontFamily: fonts.text, fontSize: 10 },
  hole: { width: 6, height: 6, borderRadius: 1, backgroundColor: c.surfaceTertiary },
  equip: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, backgroundColor: c.surfaceTertiary, borderLeftWidth: 4, marginVertical: 1 },
  equipLabel: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 13 },
  equipMeta: { color: c.muted, fontFamily: fonts.text, fontSize: 10 },
  screws: { gap: 6 },
  screw: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.borderStrong },
  sheetLabel: { color: c.muted, fontFamily: fonts.text, fontSize: 12, letterSpacing: 0.5 },
  kindGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  kind: { width: "31%", flexGrow: 1, minHeight: 72, padding: 8, gap: 4, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary },
  kindActive: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  kindText: { color: c.onSurfaceTertiary, fontFamily: fonts.text, fontSize: 11 },
  kindSize: { color: c.muted, fontFamily: fonts.displayMedium, fontSize: 10 },
}));
