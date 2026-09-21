import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";

import { fileUrl, uploadImage } from "@/src/api";
import { Button, Header, Icon, Input, Row, Screen, Select, StickyBar, confirmAsync, notify } from "@/src/components/ui";
import { DEVICE_KINDS, DEVICE_KIND_MAP, DEVICE_STATUS, Device, PREVENTIVE_OPTIONS } from "@/src/devices";
import { useItem, useList, useSave } from "@/src/hooks";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { Client } from "@/src/types";

const EMPTY: Device = {
  id: "",
  name: "",
  kind: "computador",
  asset_tag: "",
  serial: "",
  brand: "",
  model: "",
  sector: "",
  client_id: "",
  client_name: "",
  photo_path: "",
  specs: {},
  preventive_months: 3,
  last_preventive: "",
  status: "ativo",
  notes: "",
};

export default function DeviceForm() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isNew = !id;
  const { item } = useItem<Device>("devices", id);
  const clients = useList<Client>("clients");
  const save = useSave<Device>("devices");
  const [d, setD] = useState<Device>(EMPTY);
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (item) setD({ ...item, specs: item.specs ?? {} });
  }, [item]);

  const set = (k: keyof Device) => (v: string) => setD((p) => ({ ...p, [k]: v }));
  const setSpec = (k: string) => (v: string) => setD((p) => ({ ...p, specs: { ...p.specs, [k]: v } }));
  const kind = DEVICE_KIND_MAP[d.kind] ?? DEVICE_KIND_MAP.outro;

  const ensurePermission = async (camera: boolean) => {
    if (Platform.OS === "web") return true;
    const get = camera ? ImagePicker.getCameraPermissionsAsync : ImagePicker.getMediaLibraryPermissionsAsync;
    const req = camera ? ImagePicker.requestCameraPermissionsAsync : ImagePicker.requestMediaLibraryPermissionsAsync;
    let perm = await get();
    if (!perm.granted && perm.canAskAgain) perm = await req();
    if (!perm.granted) {
      if (await confirmAsync("Permissão necessária", `Permita o acesso à ${camera ? "câmera" : "galeria"} para adicionar a foto do dispositivo. Abrir configurações?`)) Linking.openSettings();
      return false;
    }
    return true;
  };

  const takePhoto = async (camera: boolean) => {
    if (!(await ensurePermission(camera))) return;
    const res = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setUploading(true);
    try {
      const path = await uploadImage(a.uri, a.fileName || "dispositivo.jpg", a.mimeType || "image/jpeg");
      setD((p) => ({ ...p, photo_path: path }));
    } catch (e: any) {
      notify("Falha no upload", e?.message);
    } finally {
      setUploading(false);
    }
  };

  const doSave = async () => {
    if (!d.name.trim()) {
      setErr("Informe um nome/identificação");
      return;
    }
    setErr("");
    try {
      const body: any = { ...d, preventive_months: Number(d.preventive_months) || 0 };
      if (isNew) delete body.id;
      const saved = await save.mutateAsync(body);
      if (isNew) router.replace(`/device/${saved.id}`);
      else router.back();
    } catch (e: any) {
      notify("Erro ao salvar", e?.message);
    }
  };

  return (
    <Screen>
      <Header title={isNew ? "Novo dispositivo" : `Editar · ${d.name}`} back />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Row gap={12}>
            <Pressable onPress={() => takePhoto(true)} style={styles.photo} testID="device-photo">
              {d.photo_path ? <Image source={{ uri: fileUrl(d.photo_path) }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Icon name="camera-outline" size={28} color={colors.muted} />}
            </Pressable>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.hint}>Foto do dispositivo no local</Text>
              <Button small title="Tirar foto" icon="camera-outline" variant="secondary" onPress={() => takePhoto(true)} loading={uploading} testID="device-camera" />
              <Button small title="Galeria" icon="image-outline" variant="ghost" onPress={() => takePhoto(false)} testID="device-gallery" />
            </View>
          </Row>

          <Text style={styles.section}>TIPO DE DISPOSITIVO</Text>
          <View style={styles.kindGrid}>
            {DEVICE_KINDS.map((k) => {
              const active = k.value === d.kind;
              return (
                <Pressable key={k.value} testID={`device-kind-${k.value}`} onPress={() => setD((p) => ({ ...p, kind: k.value }))} style={[styles.kind, active && styles.kindActive]}>
                  <Icon name={k.icon as any} size={18} color={active ? colors.brandPrimary : colors.onSurfaceTertiary} />
                  <Text style={[styles.kindText, active && { color: colors.onBrandTertiary }]}>{k.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.section}>IDENTIFICAÇÃO</Text>
          <Input label="Nome / identificação *" value={d.name} onChangeText={set("name")} placeholder="PC Recepção 01" error={err} testID="device-name" />
          <Row gap={8}>
            <Input style={{ flex: 1 }} label="Patrimônio" value={d.asset_tag} onChangeText={set("asset_tag")} placeholder="PAT-0001" autoCapitalize="characters" testID="device-tag" />
            <Input style={{ flex: 1 }} label="Nº de série" value={d.serial} onChangeText={set("serial")} placeholder="Se houver" autoCapitalize="characters" testID="device-serial" />
          </Row>
          <Row gap={8}>
            <Input style={{ flex: 1 }} label="Marca" value={d.brand} onChangeText={set("brand")} placeholder="Dell" testID="device-brand" />
            <Input style={{ flex: 1 }} label="Modelo" value={d.model} onChangeText={set("model")} placeholder="OptiPlex 3090" testID="device-model" />
          </Row>
          <Input label="Setor / local onde está alocado" value={d.sector} onChangeText={set("sector")} placeholder="Recepção, Financeiro, CPD..." testID="device-sector" />
          <Select label="Cliente" value={d.client_id ?? ""} options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))} onChange={(v) => setD((p) => ({ ...p, client_id: v, client_name: clients.data?.find((c) => c.id === v)?.name ?? "" }))} testID="device-client" />

          <Text style={styles.section}>CONFIGURAÇÃO · {kind.label.toUpperCase()}</Text>
          <Text style={styles.hint}>Preencha somente o que souber; campos em branco são permitidos.</Text>
          {kind.specs.map((f) => (
            <Input key={f.key} label={f.label} value={d.specs[f.key] ?? ""} onChangeText={setSpec(f.key)} placeholder={f.placeholder} testID={`spec-${f.key}`} />
          ))}

          <Text style={styles.section}>MANUTENÇÃO</Text>
          <Select label="Periodicidade da preventiva" value={String(d.preventive_months)} options={PREVENTIVE_OPTIONS} onChange={(v) => setD((p) => ({ ...p, preventive_months: Number(v) }))} testID="device-preventive" />
          <Select label="Status" value={d.status} options={DEVICE_STATUS} onChange={(v) => setD((p) => ({ ...p, status: v }))} testID="device-status" />
          <Input label="Observações" value={d.notes} onChangeText={set("notes")} multiline />
        </ScrollView>
      </KeyboardAvoidingView>
      <StickyBar>
        <Button title="Salvar dispositivo" icon="save-outline" onPress={doSave} loading={save.isPending} style={{ flex: 1 }} testID="device-save" />
      </StickyBar>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  photo: { width: 110, height: 110, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  hint: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
  section: { color: c.muted, fontFamily: fonts.displayMedium, fontSize: 13, letterSpacing: 1.2, marginTop: 8 },
  kindGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  kind: { width: "23%", flexGrow: 1, minHeight: 60, padding: 6, gap: 4, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  kindActive: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  kindText: { color: c.onSurfaceTertiary, fontFamily: fonts.text, fontSize: 10, textAlign: "center" },
}));
