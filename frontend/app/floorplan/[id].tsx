import React, { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import Svg, { Defs, Path, Pattern, Rect, Text as SvgText } from "react-native-svg";

import { fileUrl, uploadImage } from "@/src/api";
import { Button, Card, Header, Icon, IconButton, Input, Row, Screen, Select, Sheet, StickyBar, confirmAsync, notify } from "@/src/components/ui";
import { useItem, useList, useRemove, useSave } from "@/src/hooks";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { Client, FloorPlan, FloorPoint, FloorRoom, uid } from "@/src/types";

const EMPTY: FloorPlan = { id: "", name: "", client_id: "", client_name: "", mode: "upload", image_path: "", points: [], rooms: [] };

const POINT_KINDS: { value: string; label: string; icon: string; color: "brandPrimary" | "success" | "warning" | "error" | "onSurfaceTertiary" }[] = [
  { value: "network", label: "Ponto de rede (RJ45)", icon: "ellipse", color: "brandPrimary" },
  { value: "wifi", label: "Access Point", icon: "wifi", color: "success" },
  { value: "camera", label: "Câmera", icon: "videocam", color: "warning" },
  { value: "phone", label: "Telefone", icon: "call", color: "onSurfaceTertiary" },
  { value: "rack", label: "Rack", icon: "server", color: "error" },
  { value: "power", label: "Tomada elétrica", icon: "flash", color: "warning" },
];
const KIND_MAP = Object.fromEntries(POINT_KINDS.map((k) => [k.value, k]));

type Tool = "none" | "point" | "room";

export default function FloorPlanScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const { item, isLoading } = useItem<FloorPlan>("floorplans", isNew ? undefined : id);
  const clients = useList<Client>("clients");
  const save = useSave<FloorPlan>("floorplans");
  const remove = useRemove("floorplans");

  const [fp, setFp] = useState<FloorPlan>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [settings, setSettings] = useState(isNew);
  const [tool, setTool] = useState<Tool>("none");
  const [ratio, setRatio] = useState(1.4);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [uploading, setUploading] = useState(false);
  const [pointSel, setPointSel] = useState<FloorPoint | null>(null);
  const [roomSel, setRoomSel] = useState<FloorRoom | null>(null);

  useEffect(() => {
    if (item) setFp({ ...item, rooms: item.rooms ?? [] });
  }, [item]);

  const patch = (p: Partial<FloorPlan>) => {
    setFp((prev) => ({ ...prev, ...p }));
    setDirty(true);
  };

  const pickImage = async () => {
    if (Platform.OS !== "web") {
      let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!perm.granted && perm.canAskAgain) perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        if (await confirmAsync("Permissão necessária", "Permita o acesso às fotos para enviar a planta. Abrir configurações?")) Linking.openSettings();
        return;
      }
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setUploading(true);
    try {
      const path = await uploadImage(a.uri, a.fileName || "planta.jpg", a.mimeType || "image/jpeg");
      if (a.width && a.height) setRatio(a.width / a.height);
      patch({ image_path: path, mode: "upload" });
    } catch (e: any) {
      notify("Falha no upload", e?.message);
    } finally {
      setUploading(false);
    }
  };

  const onCanvasPress = (e: any) => {
    if (tool === "none" || !box.w) return;
    const ne = e.nativeEvent ?? {};
    const lx = ne.locationX ?? ne.offsetX ?? 0;
    const ly = ne.locationY ?? ne.offsetY ?? 0;
    const x = Math.round((lx / box.w) * 1000) / 10;
    const y = Math.round((ly / box.h) * 1000) / 10;
    if (tool === "point") {
      const p: FloorPoint = { id: uid(), x, y, label: `P${fp.points.length + 1}`, kind: "network", room: "", detail: "" };
      patch({ points: [...fp.points, p] });
      setPointSel(p);
    } else {
      const r: FloorRoom = { id: uid(), x: Math.max(0, x - 10), y: Math.max(0, y - 8), w: 20, h: 16, label: `Sala ${fp.rooms.length + 1}` };
      patch({ rooms: [...fp.rooms, r] });
      setRoomSel(r);
    }
    setTool("none");
  };

  const savePoint = () => {
    if (!pointSel) return;
    patch({ points: fp.points.map((p) => (p.id === pointSel.id ? pointSel : p)) });
    setPointSel(null);
  };
  const saveRoom = () => {
    if (!roomSel) return;
    patch({ rooms: fp.rooms.map((r) => (r.id === roomSel.id ? roomSel : r)) });
    setRoomSel(null);
  };

  const doSave = async () => {
    if (!fp.name.trim()) {
      setSettings(true);
      notify("Informe o nome da planta");
      return;
    }
    try {
      const body: any = { ...fp };
      if (isNew) delete body.id;
      const saved = await save.mutateAsync(body);
      setDirty(false);
      setSettings(false);
      if (isNew) router.replace(`/floorplan/${saved.id}`);
    } catch (e: any) {
      notify("Erro ao salvar", e?.message);
    }
  };

  const doDelete = async () => {
    if (!(await confirmAsync("Excluir planta", "Esta ação não pode ser desfeita."))) return;
    await remove.mutateAsync(fp.id);
    router.back();
  };

  const roomAt = (p: FloorPoint) => fp.rooms.find((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)?.label;
  const canvasRatio = fp.mode === "upload" ? ratio : 1.4;

  if (!isNew && isLoading) return <Screen><Header title="Planta" back /></Screen>;

  return (
    <Screen>
      <Header
        title={fp.name || "Nova planta"}
        subtitle={`${fp.mode === "upload" ? "Imagem" : "Desenho"} · ${fp.points.length} pontos${fp.client_name ? ` · ${fp.client_name}` : ""}`}
        back
        right={
          <Row gap={0}>
            <IconButton name="settings-outline" onPress={() => setSettings(true)} testID="fp-settings" />
            {!isNew ? <IconButton name="trash-outline" color={colors.error} onPress={doDelete} testID="fp-delete" /> : null}
          </Row>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 24 }}>
        <Row gap={8} style={{ flexWrap: "wrap" }}>
          <Button small title={tool === "point" ? "Toque na planta..." : "Adicionar ponto"} icon="add-circle-outline" variant={tool === "point" ? "primary" : "secondary"} onPress={() => setTool(tool === "point" ? "none" : "point")} testID="tool-point" disabled={fp.mode === "upload" && !fp.image_path} />
          {fp.mode === "draw" ? (
            <Button small title={tool === "room" ? "Toque para posicionar..." : "Adicionar cômodo"} icon="square-outline" variant={tool === "room" ? "primary" : "secondary"} onPress={() => setTool(tool === "room" ? "none" : "room")} testID="tool-room" />
          ) : (
            <Button small title={fp.image_path ? "Trocar imagem" : "Enviar imagem"} icon="image-outline" variant="secondary" onPress={pickImage} loading={uploading} testID="fp-upload" />
          )}
        </Row>

        <View style={[styles.canvasWrap, tool !== "none" && { borderColor: colors.brandPrimary }]}>
          <Pressable
            testID="fp-canvas"
            onPress={onCanvasPress}
            onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
            style={{ width: "100%", aspectRatio: canvasRatio }}
          >
            {fp.mode === "upload" ? (
              fp.image_path ? (
                <Image
                  source={{ uri: fileUrl(fp.image_path) }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="fill"
                  onLoad={(e) => e.source?.width && e.source?.height && setRatio(e.source.width / e.source.height)}
                />
              ) : (
                <View style={styles.placeholder}>
                  <Icon name="image-outline" size={36} color={colors.muted} />
                  <Text style={styles.placeholderText}>Envie a imagem da planta baixa</Text>
                </View>
              )
            ) : (
              <Svg width="100%" height="100%" viewBox="0 0 100 71.4" preserveAspectRatio="none">
                <Defs>
                  <Pattern id="fgrid" width={5} height={5} patternUnits="userSpaceOnUse">
                    <Path d="M5 0 L0 0 0 5" fill="none" stroke={colors.canvasGrid} strokeWidth={0.2} />
                  </Pattern>
                </Defs>
                <Rect width={100} height={71.4} fill={colors.surfaceSecondary} />
                <Rect width={100} height={71.4} fill="url(#fgrid)" />
                {fp.rooms.map((r) => (
                  <React.Fragment key={r.id}>
                    <Rect x={r.x} y={r.y * 0.714} width={r.w} height={r.h * 0.714} fill={colors.surfaceTertiary} stroke={colors.onSurfaceTertiary} strokeWidth={0.5} />
                    <SvgText x={r.x + 1} y={r.y * 0.714 + 3} fontSize={2.6} fill={colors.onSurface}>
                      {r.label}
                    </SvgText>
                  </React.Fragment>
                ))}
              </Svg>
            )}
            {fp.mode === "draw"
              ? fp.rooms.map((r) => (
                  <Pressable
                    key={r.id}
                    testID={`room-${r.id}`}
                    onPress={() => tool === "none" && setRoomSel({ ...r })}
                    style={{ position: "absolute", left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
                    pointerEvents={tool === "none" ? "auto" : "none"}
                  />
                ))
              : null}
            {fp.points.map((p) => {
              const k = KIND_MAP[p.kind] ?? KIND_MAP.network;
              return (
                <Pressable key={p.id} testID={`point-${p.id}`} onPress={() => setPointSel({ ...p })} style={[styles.marker, { left: `${p.x}%`, top: `${p.y}%`, borderColor: colors[k.color] }]} hitSlop={6}>
                  <Icon name={k.icon as any} size={12} color={colors[k.color]} />
                  <Text style={styles.markerText}>{p.label}</Text>
                </Pressable>
              );
            })}
          </Pressable>
        </View>

        <Row gap={10} style={{ flexWrap: "wrap" }}>
          {POINT_KINDS.map((k) => (
            <Row key={k.value} gap={4}>
              <Icon name={k.icon as any} size={12} color={colors[k.color]} />
              <Text style={styles.legend}>{k.label}</Text>
            </Row>
          ))}
        </Row>

        <Text style={styles.sectionTitle}>PONTOS DE REDE ({fp.points.length})</Text>
        {fp.points.length === 0 ? <Text style={styles.legend}>Use "Adicionar ponto" e toque no local desejado da planta.</Text> : null}
        {fp.points.map((p) => {
          const k = KIND_MAP[p.kind] ?? KIND_MAP.network;
          return (
            <Card key={p.id} onPress={() => setPointSel({ ...p })} testID={`point-card-${p.id}`}>
              <Row>
                <Icon name={k.icon as any} size={18} color={colors[k.color]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pointTitle}>
                    {p.label} · {k.label}
                  </Text>
                  <Text style={styles.legend}>{[p.room || roomAt(p), p.detail].filter(Boolean).join(" · ") || `${p.x}% , ${p.y}%`}</Text>
                </View>
                <Icon name="chevron-forward" size={16} color={colors.muted} />
              </Row>
            </Card>
          );
        })}
      </ScrollView>

      <StickyBar>
        <Button title={dirty || isNew ? "Salvar" : "Salvo"} icon="save-outline" onPress={doSave} loading={save.isPending} disabled={!dirty && !isNew} style={{ flex: 1 }} testID="fp-save" />
      </StickyBar>

      <Sheet visible={settings} onClose={() => setSettings(false)} title="Planta baixa" footer={<Button title="Aplicar" onPress={() => (fp.name.trim() ? setSettings(false) : notify("Informe o nome"))} testID="fp-settings-apply" />}>
        <Input label="Nome *" value={fp.name} onChangeText={(v) => patch({ name: v })} placeholder="Escritório - 1º andar" testID="fp-name" />
        <Select label="Cliente" value={fp.client_id ?? ""} options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))} onChange={(v) => patch({ client_id: v, client_name: clients.data?.find((c) => c.id === v)?.name ?? "" })} testID="fp-client" />
        <Select
          label="Modo"
          value={fp.mode}
          options={[
            { value: "upload", label: "Enviar imagem da planta", hint: "Foto ou arquivo da planta baixa" },
            { value: "draw", label: "Desenhar planta simples", hint: "Cômodos retangulares sobre grade" },
          ]}
          onChange={(v) => patch({ mode: v })}
          testID="fp-mode"
        />
      </Sheet>

      <Sheet
        visible={!!pointSel}
        onClose={() => setPointSel(null)}
        title="Ponto de rede"
        footer={
          <Row gap={8}>
            <Button title="Remover" variant="danger" testID="point-remove" onPress={() => { if (pointSel) patch({ points: fp.points.filter((p) => p.id !== pointSel.id) }); setPointSel(null); }} />
            <Button title="Salvar" style={{ flex: 1 }} onPress={savePoint} testID="point-save" />
          </Row>
        }
      >
        {pointSel ? (
          <>
            <Row gap={8}>
              <Input style={{ flex: 1 }} label="Identificação" value={pointSel.label} onChangeText={(v) => setPointSel({ ...pointSel, label: v })} testID="point-label" />
              <View style={{ flex: 1.4 }}>
                <Select label="Tipo" value={pointSel.kind} options={POINT_KINDS} onChange={(v) => setPointSel({ ...pointSel, kind: v })} testID="point-kind" />
              </View>
            </Row>
            <Input label="Sala / Local" value={pointSel.room} onChangeText={(v) => setPointSel({ ...pointSel, room: v })} placeholder={roomAt(pointSel) ?? "Recepção"} />
            <Input label="Detalhes" value={pointSel.detail} onChangeText={(v) => setPointSel({ ...pointSel, detail: v })} placeholder="Patch panel 1 porta 12 · Cat6" />
          </>
        ) : null}
      </Sheet>

      <Sheet
        visible={!!roomSel}
        onClose={() => setRoomSel(null)}
        title="Cômodo"
        footer={
          <Row gap={8}>
            <Button title="Remover" variant="danger" testID="room-remove" onPress={() => { if (roomSel) patch({ rooms: fp.rooms.filter((r) => r.id !== roomSel.id) }); setRoomSel(null); }} />
            <Button title="Salvar" style={{ flex: 1 }} onPress={saveRoom} testID="room-save" />
          </Row>
        }
      >
        {roomSel ? (
          <>
            <Input label="Nome" value={roomSel.label} onChangeText={(v) => setRoomSel({ ...roomSel, label: v })} testID="room-label" />
            <Row gap={8}>
              <Input style={{ flex: 1 }} label="Largura (%)" value={String(roomSel.w)} onChangeText={(v) => setRoomSel({ ...roomSel, w: Math.max(2, Math.min(100, Number(v) || 0)) })} keyboardType="number-pad" />
              <Input style={{ flex: 1 }} label="Altura (%)" value={String(roomSel.h)} onChangeText={(v) => setRoomSel({ ...roomSel, h: Math.max(2, Math.min(100, Number(v) || 0)) })} keyboardType="number-pad" />
            </Row>
            <Row gap={8}>
              <Input style={{ flex: 1 }} label="Posição X (%)" value={String(roomSel.x)} onChangeText={(v) => setRoomSel({ ...roomSel, x: Math.max(0, Math.min(98, Number(v) || 0)) })} keyboardType="number-pad" />
              <Input style={{ flex: 1 }} label="Posição Y (%)" value={String(roomSel.y)} onChangeText={(v) => setRoomSel({ ...roomSel, y: Math.max(0, Math.min(98, Number(v) || 0)) })} keyboardType="number-pad" />
            </Row>
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  canvasWrap: { borderWidth: 2, borderColor: c.border, borderRadius: 4, overflow: "hidden", backgroundColor: c.surfaceSecondary },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  placeholderText: { color: c.muted, fontFamily: fonts.text, fontSize: 13 },
  marker: { position: "absolute", marginLeft: -14, marginTop: -14, minWidth: 28, height: 28, borderRadius: 14, borderWidth: 2, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 2, paddingHorizontal: 4 },
  markerText: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 10 },
  legend: { color: c.muted, fontFamily: fonts.text, fontSize: 11 },
  sectionTitle: { color: c.muted, fontFamily: fonts.displayMedium, fontSize: 13, letterSpacing: 1.2, marginTop: 4 },
  pointTitle: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 14 },
}));
