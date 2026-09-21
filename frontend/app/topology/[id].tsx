import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button, Header, Icon, IconButton, Input, Row, Screen, Select, Sheet, StickyBar, confirmAsync, notify } from "@/src/components/ui";
import { CanvasHandle, TopologyCanvas } from "@/src/components/topology-canvas";
import { useItem, useList, useRemove, useSave } from "@/src/hooks";
import { canSharePdf, printHtml, sharePdf } from "@/src/pdf";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { AutoConfig, CANVAS_H, CANVAS_W, DEFAULT_AUTO, NODE_KINDS, NODE_KIND_MAP, autoGenerate, topologyHtml } from "@/src/topology";
import { Client, TopoLink, TopoNode, Topology, uid } from "@/src/types";

const EMPTY: Topology = { id: "", name: "", client_id: "", client_name: "", nodes: [], links: [] };

export default function TopologyEditor() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const { item, isLoading } = useItem<Topology>("topologies", isNew ? undefined : id);
  const clients = useList<Client>("clients");
  const save = useSave<Topology>("topologies");
  const remove = useRemove("topologies");
  const canvas = useRef<CanvasHandle | null>(null);

  const [t, setT] = useState<Topology>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [settings, setSettings] = useState(isNew);
  const [selected, setSelected] = useState<TopoNode | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [addSheet, setAddSheet] = useState(false);
  const [autoSheet, setAutoSheet] = useState(false);
  const [autoCfg, setAutoCfg] = useState<AutoConfig>(DEFAULT_AUTO);
  const [linkSel, setLinkSel] = useState<TopoLink | null>(null);

  useEffect(() => {
    if (item) setT(item);
  }, [item]);

  const patch = (p: Partial<Topology>) => {
    setT((prev) => ({ ...prev, ...p }));
    setDirty(true);
  };

  const onNodeMove = useCallback((nid: string, x: number, y: number) => {
    setT((prev) => ({ ...prev, nodes: prev.nodes.map((n) => (n.id === nid ? { ...n, x, y } : n)) }));
    setDirty(true);
  }, []);

  const tRef = useRef(t);
  tRef.current = t;

  const onNodeTap = useCallback(
    (nid: string) => {
      if (connectFrom) {
        if (connectFrom === nid) {
          setConnectFrom(null);
          return;
        }
        const prev = tRef.current;
        const exists = prev.links.some((l) => (l.source === connectFrom && l.target === nid) || (l.source === nid && l.target === connectFrom));
        if (!exists) {
          setT({ ...prev, links: [...prev.links, { id: uid(), source: connectFrom, target: nid, label: "" }] });
          setDirty(true);
        }
        setConnectFrom(null);
        return;
      }
      const n = tRef.current.nodes.find((x) => x.id === nid);
      if (n) setSelected({ ...n });
    },
    [connectFrom],
  );

  const onLinkTap = useCallback((lid: string) => {
    const l = tRef.current.links.find((x) => x.id === lid);
    if (l) setLinkSel({ ...l });
  }, []);

  const saveNode = () => {
    if (!selected) return;
    patch({ nodes: t.nodes.map((n) => (n.id === selected.id ? selected : n)) });
    setSelected(null);
  };

  const removeNode = () => {
    if (!selected) return;
    patch({ nodes: t.nodes.filter((n) => n.id !== selected.id), links: t.links.filter((l) => l.source !== selected.id && l.target !== selected.id) });
    setSelected(null);
  };

  const startConnect = () => {
    if (!selected) return;
    setConnectFrom(selected.id);
    setSelected(null);
  };

  const addNode = (kind: string) => {
    const meta = NODE_KIND_MAP[kind];
    const count = t.nodes.filter((n) => n.kind === kind).length + 1;
    const n: TopoNode = { id: uid(), kind, label: `${meta.label.split(" ")[0]} ${count}`, x: CANVAS_W / 2 + (t.nodes.length % 5) * 60 - 120, y: CANVAS_H / 2 + Math.floor(t.nodes.length / 5) * 80 - 100, ip: "", ports: "", room: "" };
    patch({ nodes: [...t.nodes, n] });
    setAddSheet(false);
    setSelected(n);
  };

  const runAuto = () => {
    const gen = autoGenerate(autoCfg);
    patch({ nodes: gen.nodes, links: gen.links });
    setAutoSheet(false);
    setTimeout(() => canvas.current?.fit(), 50);
  };

  const doSave = async () => {
    if (!t.name.trim()) {
      setSettings(true);
      notify("Informe o nome da topologia");
      return;
    }
    try {
      const body: any = { ...t };
      if (isNew) delete body.id;
      const saved = await save.mutateAsync(body);
      setDirty(false);
      setSettings(false);
      if (isNew) router.replace(`/topology/${saved.id}`);
    } catch (e: any) {
      notify("Erro ao salvar", e?.message);
    }
  };

  const doDelete = async () => {
    if (!(await confirmAsync("Excluir topologia", "Esta ação não pode ser desfeita."))) return;
    await remove.mutateAsync(t.id);
    router.back();
  };

  const exportPdf = async (share: boolean) => {
    try {
      const html = topologyHtml(t);
      if (share) await sharePdf(html, `${t.name || "topologia"}.pdf`);
      else await printHtml(html);
    } catch (e: any) {
      notify("Falha ao gerar PDF", e?.message);
    }
  };

  const setCfg = (k: keyof AutoConfig) => (v: string) => setAutoCfg((c) => ({ ...c, [k]: Math.max(0, Math.min(60, parseInt(v || "0", 10) || 0)) }));

  if (!isNew && isLoading) return <Screen><Header title="Topologia" back /></Screen>;

  return (
    <Screen>
      <Header
        title={t.name || "Nova topologia"}
        subtitle={`${t.nodes.length} dispositivos · ${t.links.length} conexões${t.client_name ? ` · ${t.client_name}` : ""}`}
        back
        right={
          <Row gap={0}>
            <IconButton name="settings-outline" onPress={() => setSettings(true)} testID="topo-settings" />
            {!isNew ? <IconButton name="trash-outline" color={colors.error} onPress={doDelete} testID="topo-delete" /> : null}
          </Row>
        }
      />

      {connectFrom ? (
        <View style={styles.banner} testID="connect-banner">
          <Icon name="git-branch-outline" size={18} color={colors.onBrandPrimary} />
          <Text style={styles.bannerText}>Toque no dispositivo de destino para conectar</Text>
          <Pressable onPress={() => setConnectFrom(null)} testID="connect-cancel">
            <Text style={[styles.bannerText, { textDecorationLine: "underline" }]}>Cancelar</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        <TopologyCanvas nodes={t.nodes} links={t.links} selectedId={selected?.id} connectFrom={connectFrom} onNodeTap={onNodeTap} onNodeMove={onNodeMove} onLinkTap={onLinkTap} handleRef={canvas} />
        {t.nodes.length === 0 ? (
          <View style={styles.emptyOverlay} pointerEvents="none">
            <Icon name="git-network-outline" size={40} color={colors.muted} />
            <Text style={styles.emptyTitle}>Canvas vazio</Text>
            <Text style={styles.emptyHint}>Adicione dispositivos ou gere a topologia automaticamente.</Text>
          </View>
        ) : null}
        <View style={styles.zoomBox}>
          <IconButton name="add" onPress={() => canvas.current?.zoomBy(1.25)} testID="zoom-in" />
          <IconButton name="remove" onPress={() => canvas.current?.zoomBy(0.8)} testID="zoom-out" />
          <IconButton name="scan-outline" onPress={() => canvas.current?.fit()} testID="zoom-fit" />
        </View>
      </View>

      <StickyBar>
        <Button title={dirty || isNew ? "Salvar" : "Salvo"} icon="save-outline" onPress={doSave} loading={save.isPending} disabled={!dirty && !isNew} style={{ flex: 1 }} testID="topo-save" />
        <Button title="" icon="add-circle-outline" variant="secondary" onPress={() => setAddSheet(true)} testID="topo-add" />
        <Button title="Auto" icon="flash-outline" variant="secondary" onPress={() => setAutoSheet(true)} testID="topo-auto" />
        <Button title="" icon="print-outline" variant="secondary" onPress={() => exportPdf(false)} testID="topo-print" />
        {canSharePdf ? <Button title="" icon="share-outline" variant="secondary" onPress={() => exportPdf(true)} /> : null}
      </StickyBar>

      {/* Settings */}
      <Sheet visible={settings} onClose={() => setSettings(false)} title="Topologia" footer={<Button title="Aplicar" onPress={() => (t.name.trim() ? setSettings(false) : notify("Informe o nome"))} testID="topo-settings-apply" />}>
        <Input label="Nome *" value={t.name} onChangeText={(v) => patch({ name: v })} placeholder="Rede matriz - Térreo" testID="topo-name" />
        <Select label="Cliente" value={t.client_id ?? ""} options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))} onChange={(v) => patch({ client_id: v, client_name: clients.data?.find((c) => c.id === v)?.name ?? "" })} testID="topo-client" />
      </Sheet>

      {/* Node editor */}
      <Sheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${NODE_KIND_MAP[selected.kind]?.label ?? selected.kind}` : ""}
        footer={
          <Row gap={8}>
            <Button title="Remover" variant="danger" onPress={removeNode} testID="node-remove" />
            <Button title="Conectar" variant="secondary" icon="git-branch-outline" onPress={startConnect} testID="node-connect" />
            <Button title="Salvar" onPress={saveNode} style={{ flex: 1 }} testID="node-save" />
          </Row>
        }
      >
        {selected ? (
          <>
            <Input label="Nome" value={selected.label} onChangeText={(v) => setSelected({ ...selected, label: v })} testID="node-label" />
            <Select label="Tipo" value={selected.kind} options={NODE_KINDS.map((k) => ({ value: k.kind, label: k.label }))} onChange={(v) => setSelected({ ...selected, kind: v })} testID="node-kind" />
            <Row gap={8}>
              <Input style={{ flex: 1 }} label="IP / Rede" value={selected.ip} onChangeText={(v) => setSelected({ ...selected, ip: v })} placeholder="192.168.0.10" autoCapitalize="none" testID="node-ip" />
              <Input style={{ flex: 1 }} label="Portas" value={selected.ports} onChangeText={(v) => setSelected({ ...selected, ports: v })} placeholder="24x1G + 4xSFP" testID="node-ports" />
            </Row>
            <Input label="Local / Sala" value={selected.room} onChangeText={(v) => setSelected({ ...selected, room: v })} placeholder="Sala técnica" />
            <Text style={styles.hint}>
              Conexões: {t.links.filter((l) => l.source === selected.id || l.target === selected.id).length}. Arraste o dispositivo no canvas para reposicionar.
            </Text>
          </>
        ) : null}
      </Sheet>

      {/* Link editor */}
      <Sheet
        visible={!!linkSel}
        onClose={() => setLinkSel(null)}
        title="Conexão"
        footer={
          <Row gap={8}>
            <Button
              title="Remover"
              variant="danger"
              testID="link-remove"
              onPress={() => {
                if (linkSel) patch({ links: t.links.filter((l) => l.id !== linkSel.id) });
                setLinkSel(null);
              }}
            />
            <Button
              title="Salvar"
              style={{ flex: 1 }}
              testID="link-save"
              onPress={() => {
                if (linkSel) patch({ links: t.links.map((l) => (l.id === linkSel.id ? linkSel : l)) });
                setLinkSel(null);
              }}
            />
          </Row>
        }
      >
        {linkSel ? (
          <>
            <Text style={styles.hint}>
              {t.nodes.find((n) => n.id === linkSel.source)?.label} ⟷ {t.nodes.find((n) => n.id === linkSel.target)?.label}
            </Text>
            <Input label="Rótulo (porta / VLAN / cabo)" value={linkSel.label} onChangeText={(v) => setLinkSel({ ...linkSel, label: v })} placeholder="Gi0/1 · VLAN 10 · Cat6" testID="link-label" />
          </>
        ) : null}
      </Sheet>

      {/* Add node */}
      <Sheet visible={addSheet} onClose={() => setAddSheet(false)} title="Adicionar dispositivo">
        <View style={styles.kindGrid}>
          {NODE_KINDS.map((k) => (
            <Pressable key={k.kind} testID={`add-kind-${k.kind}`} onPress={() => addNode(k.kind)} style={styles.kind}>
              <Icon name={k.icon as any} size={22} color={k.color} />
              <Text style={styles.kindText}>{k.label}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>

      {/* Auto generate */}
      <Sheet visible={autoSheet} onClose={() => setAutoSheet(false)} title="Gerar topologia automaticamente" footer={<Button title="Gerar" icon="flash-outline" onPress={runAuto} testID="auto-run" />}>
        <Text style={styles.hint}>Informe a quantidade de equipamentos. A topologia será gerada em estrela (roteador → switches → dispositivos finais) e poderá ser ajustada manualmente.</Text>
        <Row>
          <Text style={[styles.hint, { flex: 1, color: colors.onSurface }]}>Incluir Internet / WAN</Text>
          <Switch value={autoCfg.hasInternet} onValueChange={(v) => setAutoCfg({ ...autoCfg, hasInternet: v })} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} testID="auto-internet" />
        </Row>
        <Row gap={8}>
          <Input style={{ flex: 1 }} label="Roteadores" value={String(autoCfg.routers)} onChangeText={setCfg("routers")} keyboardType="number-pad" testID="auto-routers" />
          <Input style={{ flex: 1 }} label="Switches" value={String(autoCfg.switches)} onChangeText={setCfg("switches")} keyboardType="number-pad" testID="auto-switches" />
          <Input style={{ flex: 1 }} label="Servidores" value={String(autoCfg.servers)} onChangeText={setCfg("servers")} keyboardType="number-pad" testID="auto-servers" />
        </Row>
        <Row gap={8}>
          <Input style={{ flex: 1 }} label="Computadores" value={String(autoCfg.pcs)} onChangeText={setCfg("pcs")} keyboardType="number-pad" testID="auto-pcs" />
          <Input style={{ flex: 1 }} label="Access Points" value={String(autoCfg.aps)} onChangeText={setCfg("aps")} keyboardType="number-pad" testID="auto-aps" />
        </Row>
        <Row gap={8}>
          <Input style={{ flex: 1 }} label="Impressoras" value={String(autoCfg.printers)} onChangeText={setCfg("printers")} keyboardType="number-pad" testID="auto-printers" />
          <Input style={{ flex: 1 }} label="Câmeras" value={String(autoCfg.cameras)} onChangeText={setCfg("cameras")} keyboardType="number-pad" testID="auto-cameras" />
        </Row>
        {t.nodes.length > 0 ? <Text style={[styles.hint, { color: colors.warning }]}>Atenção: o diagrama atual será substituído.</Text> : null}
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  banner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 40, backgroundColor: c.brandPrimary },
  bannerText: { color: c.onBrandPrimary, fontFamily: fonts.displayMedium, fontSize: 13, flex: 1 },
  emptyOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 6, padding: 32 },
  emptyTitle: { color: c.onSurface, fontFamily: fonts.display, fontSize: 18 },
  emptyHint: { color: c.muted, fontFamily: fonts.text, fontSize: 13, textAlign: "center" },
  zoomBox: { position: "absolute", right: 8, top: 8, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderRadius: 4 },
  hint: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
  kindGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  kind: { width: "31%", flexGrow: 1, minHeight: 72, padding: 8, gap: 6, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  kindText: { color: c.onSurfaceTertiary, fontFamily: fonts.text, fontSize: 11, textAlign: "center" },
}));
