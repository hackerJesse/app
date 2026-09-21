import React, { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";

import { fileUrl } from "@/src/api";
import { Badge, Button, Card, Empty, Fab, Header, Icon, IconButton, Input, Loading, Row, Screen, Segmented } from "@/src/components/ui";
import { DEVICE_KINDS, DEVICE_KIND_MAP, Device, preventiveBadge, specSummary } from "@/src/devices";
import { useList } from "@/src/hooks";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { useT, tr } from "@/src/i18n";

type Filter = "todos" | "vencida" | "proxima" | string;

export default function DevicesScreen() {
  const styles = useStyles();
  const t = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>((params.filter as Filter) || "todos");
  const devices = useList<Device>("devices");

  const list = (devices.data ?? [])
    .filter((d) => {
      if (filter === "vencida") return d.preventive_state === "vencida";
      if (filter === "proxima") return d.preventive_state === "proxima" || d.preventive_state === "vencida";
      if (filter !== "todos") return d.kind === filter;
      return true;
    })
    .filter((d) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [d.name, d.asset_tag, d.serial, d.sector, d.brand, d.model, d.client_name].some((v) => (v ?? "").toLowerCase().includes(q));
    })
    .sort((a, b) => (a.preventive_days_left ?? 9999) - (b.preventive_days_left ?? 9999));

  const overdue = (devices.data ?? []).filter((d) => d.preventive_state === "vencida").length;

  return (
    <Screen>
      <Header
        title={t("devices")}
        subtitle={`${devices.data?.length ?? 0} cadastrados${overdue ? ` · ${overdue} preventiva(s) vencida(s)` : ""}`}
        right={<IconButton name="qr-code-outline" onPress={() => router.push("/scan")} testID="scan-button" color={colors.brandPrimary} />}
      />
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Input value={search} onChangeText={setSearch} placeholder={tr("Buscar por setor, patrimônio, série, nome...")} testID="device-search" autoCapitalize="none" />
      </View>
      <Segmented
        options={[
          { value: "todos", label: "Todos" },
          { value: "vencida", label: `Vencidas (${overdue})` },
          { value: "proxima", label: "Próximas" },
          ...DEVICE_KINDS.map((k) => ({ value: k.value, label: k.label })),
        ]}
        value={filter}
        onChange={setFilter}
      />
      {devices.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 100, flexGrow: 1 }}
          onRefresh={devices.refetch}
          refreshing={devices.isFetching && !devices.isLoading}
          ListEmptyComponent={
            <Empty
              icon="hardware-chip-outline"
              title={search || filter !== "todos" ? tr("Nenhum resultado") : tr("Nenhum dispositivo")}
              hint={tr("Cadastre computadores, notebooks, servidores, impressoras e gere etiquetas com QR Code.")}
              action={<Button title={tr("Novo dispositivo")} onPress={() => router.push("/device/form")} testID="empty-new-device" />}
            />
          }
          renderItem={({ item: d }) => {
            const kind = DEVICE_KIND_MAP[d.kind] ?? DEVICE_KIND_MAP.outro;
            const pb = preventiveBadge(d);
            return (
              <Card onPress={() => router.push(`/device/${d.id}`)} testID={`device-card-${d.id}`}>
                <Row gap={12}>
                  {d.photo_path ? (
                    <Image source={{ uri: fileUrl(d.photo_path) }} style={styles.thumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]}>
                      <Icon name={kind.icon as any} size={22} color={colors.brandPrimary} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Row>
                      <Text style={styles.name} numberOfLines={1}>
                        {d.name}
                      </Text>
                      {d.asset_tag ? <Text style={styles.tag}>#{d.asset_tag}</Text> : null}
                    </Row>
                    <Text style={styles.meta} numberOfLines={1}>
                      {tr(kind.label)}
                      {d.sector ? ` · ${d.sector}` : ""}
                      {d.client_name ? ` · ${d.client_name}` : ""}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {specSummary(d) || d.serial || "—"}
                    </Text>
                    {pb ? (
                      <View style={{ flexDirection: "row", marginTop: 2 }}>
                        <Badge text={pb.text} tone={pb.tone} />
                      </View>
                    ) : null}
                  </View>
                  <Icon name="chevron-forward" size={18} color={colors.muted} />
                </Row>
              </Card>
            );
          }}
        />
      )}
      <Fab onPress={() => router.push("/device/form")} testID="fab-new-device" />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  thumb: { width: 56, height: 56, borderRadius: 4, backgroundColor: c.surfaceTertiary },
  thumbEmpty: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border },
  name: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 16, flexShrink: 1 },
  tag: { color: c.brandPrimary, fontFamily: fonts.displayMedium, fontSize: 13 },
  meta: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
}));
