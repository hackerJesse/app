import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { geoToPercent } from "@/src/brazil";
import { StateCityPicker } from "@/src/components/state-city";
import { BrazilMap } from "@/src/components/brazil-map";
import { Button, Header, IconButton, Input, Row, Screen, Select, StickyBar, confirmAsync, notify } from "@/src/components/ui";
import { useItem, useList, useRemove, useSave } from "@/src/hooks";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { Client, Server, Topology } from "@/src/types";

const EMPTY: Server = {
  id: "",
  name: "",
  client_id: "",
  client_name: "",
  host: "",
  port: 443,
  state: "",
  city: "",
  map_x: 50,
  map_y: 50,
  os: "",
  cpu: "",
  ram: "",
  disk: "",
  role: "",
  notes: "",
  topology_id: "",
  status: "unknown",
};

export default function ServerForm() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const { item } = useItem<Server>("servers", isNew ? undefined : id);
  const clients = useList<Client>("clients");
  const topos = useList<Topology>("topologies");
  const save = useSave<Server>("servers");
  const remove = useRemove("servers");
  const [s, setS] = useState<Server>(EMPTY);
  const [port, setPort] = useState("443");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (item) {
      setS(item);
      setPort(String(item.port));
    }
  }, [item]);

  const set = (k: keyof Server) => (v: string) => setS((p) => ({ ...p, [k]: v }));

  const pickGeo = (v: { state: string; city: string; lat?: number; lon?: number }) => {
    setS((prev) => {
      const next = { ...prev, state: v.state, city: v.city };
      if (v.lat != null && v.lon != null) {
        const p = geoToPercent(v.lat, v.lon);
        next.map_x = p.x;
        next.map_y = p.y;
      }
      return next;
    });
  };

  const doSave = async () => {
    if (!s.name.trim() || !s.host.trim()) {
      setErr("Nome e host são obrigatórios");
      return;
    }
    setErr("");
    try {
      const body: any = { ...s, port: parseInt(port, 10) || 443 };
      if (isNew) delete body.id;
      await save.mutateAsync(body);
      router.back();
    } catch (e: any) {
      notify("Erro ao salvar", e?.message);
    }
  };

  const doDelete = async () => {
    if (!(await confirmAsync("Excluir servidor", `Remover ${s.name}?`))) return;
    await remove.mutateAsync(s.id);
    router.back();
  };

  const preview: Server = { ...s, id: s.id || "preview" };

  return (
    <Screen>
      <Header title={isNew ? "Novo servidor" : s.name || "Servidor"} back right={!isNew ? <IconButton name="trash-outline" color={colors.error} onPress={doDelete} testID="server-delete" /> : undefined} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Input label="Nome *" value={s.name} onChangeText={set("name")} placeholder="SRV-FILE-01" error={err} testID="server-name" />
          <Row gap={8}>
            <Input style={{ flex: 2 }} label="Host / IP *" value={s.host} onChangeText={set("host")} placeholder="srv.cliente.com.br" autoCapitalize="none" testID="server-host" />
            <Input style={{ flex: 1 }} label="Porta" value={port} onChangeText={setPort} keyboardType="number-pad" testID="server-port" />
          </Row>
          <Select label="Cliente" value={s.client_id ?? ""} options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))} onChange={(v) => setS((p) => ({ ...p, client_id: v, client_name: clients.data?.find((c) => c.id === v)?.name ?? "" }))} testID="server-client" />
          <Input label="Função" value={s.role} onChangeText={set("role")} placeholder="Servidor de arquivos, AD, Firewall, NVR..." testID="server-role" />

          <Text style={styles.section}>LOCALIZAÇÃO NO MAPA</Text>
          <StateCityPicker state={s.state} city={s.city} onChange={pickGeo} testID="server-geo" />
          <Text style={styles.hint}>Ou toque no mapa para ajustar a posição manualmente.</Text>
          <View style={styles.mapBox}>
            <BrazilMap servers={[preview]} selectedId={preview.id} onMapPress={(x, y) => setS((p) => ({ ...p, map_x: x, map_y: y }))} />
          </View>

          <Text style={styles.section}>ESPECIFICAÇÕES TÉCNICAS</Text>
          <Row gap={8}>
            <Input style={{ flex: 1 }} label="Sistema" value={s.os} onChangeText={set("os")} placeholder="Windows Server 2022" testID="server-os" />
            <Input style={{ flex: 1 }} label="CPU" value={s.cpu} onChangeText={set("cpu")} placeholder="Xeon E-2336" />
          </Row>
          <Row gap={8}>
            <Input style={{ flex: 1 }} label="RAM" value={s.ram} onChangeText={set("ram")} placeholder="64 GB" />
            <Input style={{ flex: 1 }} label="Disco" value={s.disk} onChangeText={set("disk")} placeholder="2x 2TB RAID1" />
          </Row>
          <Input label="Escopo de rede / observações (sensível)" value={s.notes} onChangeText={set("notes")} multiline placeholder="192.168.10.0/24 · VLAN 10 · Gateway .1" />
          <Select label="Topologia vinculada" value={s.topology_id ?? ""} options={(topos.data ?? []).map((t) => ({ value: t.id, label: t.name }))} onChange={(v) => setS((p) => ({ ...p, topology_id: v }))} testID="server-topology" />
        </ScrollView>
      </KeyboardAvoidingView>
      <StickyBar>
        <Button title="Salvar servidor" icon="save-outline" onPress={doSave} loading={save.isPending} style={{ flex: 1 }} testID="server-save" />
      </StickyBar>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  section: { color: c.muted, fontFamily: fonts.displayMedium, fontSize: 13, letterSpacing: 1.2, marginTop: 8 },
  hint: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
  mapBox: { borderWidth: 1, borderColor: c.border, borderRadius: 4, backgroundColor: c.surfaceSecondary, padding: 8 },
}));
