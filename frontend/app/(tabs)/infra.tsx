import React, { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Button, Card, Empty, Fab, Header, Icon, Loading, Screen, Segmented } from "@/src/components/ui";
import { useList } from "@/src/hooks";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { useT, tr } from "@/src/i18n";
import { FloorPlan, Rack, Topology } from "@/src/types";

type Tab = "racks" | "topologies" | "floorplans";

const META: Record<Tab, { title: string; icon: React.ComponentProps<typeof Icon>["name"]; route: string; empty: string; hint: string }> = {
  racks: { title: "Rack", icon: "server-outline", route: "rack", empty: "Nenhum rack", hint: "Monte racks de até 50U com switches, patch panels, servidores e mais." },
  topologies: { title: "Topologia", icon: "git-network-outline", route: "topology", empty: "Nenhuma topologia", hint: "Diagramas de rede estilo Packet Tracer, gerados automaticamente ou manuais." },
  floorplans: { title: "Planta", icon: "map-outline", route: "floorplan", empty: "Nenhuma planta", hint: "Envie a imagem da planta ou desenhe e marque os pontos de rede." },
};

export default function InfraScreen() {
  const styles = useStyles();
  const t = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("racks");
  const racks = useList<Rack>("racks");
  const topos = useList<Topology>("topologies");
  const plans = useList<FloorPlan>("floorplans");

  const q = tab === "racks" ? racks : tab === "topologies" ? topos : plans;
  const meta = META[tab];

  const subtitle = (item: any) => {
    if (tab === "racks") return `${item.size_u}U · ${item.slots.length} equipamentos${item.location ? ` · ${item.location}` : ""}`;
    if (tab === "topologies") return `${item.nodes.length} dispositivos · ${item.links.length} conexões`;
    return `${item.mode === "upload" ? tr("Imagem") : tr("Desenho")} · ${item.points.length} pontos de rede`;
  };

  return (
    <Screen>
      <Header title={t("infra")} subtitle={tr("Racks · Topologias · Plantas")} back />
      <Segmented
        options={[
          { value: "racks", label: `Racks (${racks.data?.length ?? 0})` },
          { value: "topologies", label: `Topologias (${topos.data?.length ?? 0})` },
          { value: "floorplans", label: `Plantas (${plans.data?.length ?? 0})` },
        ]}
        value={tab}
        onChange={setTab}
      />
      {q.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={(q.data as any[]) ?? []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 100, flexGrow: 1 }}
          onRefresh={q.refetch}
          refreshing={q.isFetching && !q.isLoading}
          ListEmptyComponent={
            <Empty icon={meta.icon} title={meta.empty} hint={meta.hint} action={<Button title={`Nov${tab === "racks" ? "o" : "a"} ${meta.title}`} onPress={() => router.push(`/${meta.route}/new` as any)} testID={`empty-new-${tab}`} />} />
          }
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/${meta.route}/${item.id}` as any)} testID={`${tab}-card-${item.id}`}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={styles.iconBox}>
                  <Icon name={meta.icon} size={22} color={colors.brandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{item.client_name || "Sem cliente"}</Text>
                  <Text style={styles.meta}>{subtitle(item)}</Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </View>
            </Card>
          )}
        />
      )}
      <Fab onPress={() => router.push(`/${meta.route}/new` as any)} testID={`fab-new-${tab}`} />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  iconBox: { width: 44, height: 44, borderRadius: 4, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  name: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 16 },
  meta: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
}));
