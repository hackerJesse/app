import React, { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Button, Card, Empty, Fab, Header, Icon, Input, Loading, Screen } from "@/src/components/ui";
import { useList } from "@/src/hooks";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { useT, tr } from "@/src/i18n";
import { Client } from "@/src/types";

export default function ClientsScreen() {
  const styles = useStyles();
  const t = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const clients = useList<Client>("clients");

  const list = (clients.data ?? [])
    .filter((c) => `${c.name} ${c.company} ${c.email}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Screen>
      <Header title={t("clients")} subtitle={`${clients.data?.length ?? 0} cadastrados`} back />
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Input value={search} onChangeText={setSearch} placeholder={tr("Buscar cliente...")} testID="client-search" />
      </View>
      {clients.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 100, flexGrow: 1 }}
          onRefresh={clients.refetch}
          refreshing={clients.isFetching && !clients.isLoading}
          ListEmptyComponent={
            <Empty
              icon="people-outline"
              title={tr("Nenhum cliente")}
              hint={tr("Cadastre clientes para vincular orçamentos, racks e topologias.")}
              action={<Button title={tr("Novo cliente")} onPress={() => router.push("/client/new")} testID="empty-new-client" />}
            />
          }
          renderItem={({ item: c }) => (
            <Card onPress={() => router.push(`/client/${c.id}`)} testID={`client-card-${c.id}`}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{c.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{c.name}</Text>
                  <Text style={styles.meta}>{[c.company, c.phone, c.email].filter(Boolean).join(" · ") || "Sem contato"}</Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </View>
            </Card>
          )}
        />
      )}
      <Fab onPress={() => router.push("/client/new")} testID="fab-new-client" />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  avatar: { width: 40, height: 40, borderRadius: 4, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: c.onBrandTertiary, fontFamily: fonts.display, fontSize: 18 },
  name: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 16 },
  meta: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
}));
