import React, { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Badge, Button, Card, Empty, Fab, Header, Input, Loading, Row, Screen, Segmented, Select } from "@/src/components/ui";
import { useList } from "@/src/hooks";
import { fonts, makeStyles } from "@/src/theme";
import { useT } from "@/src/i18n";
import { Client, QUOTE_STATUS, Quote, STATUS_TONE, fmtBRL, fmtDate, quoteTotal } from "@/src/types";

type Filter = "todos" | Quote["status"];

export default function QuotesScreen() {
  const styles = useStyles();
  const t = useT();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("todos");
  const quotes = useList<Quote>("quotes");
  const clients = useList<Client>("clients");
  const [code, setCode] = useState("");
  const [clientId, setClientId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const parseBr = (v: string) => {
    const m = v.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
  };
  const dFrom = parseBr(from);
  const dTo = parseBr(to);

  const list = [...(quotes.data ?? [])]
    .filter((q) => filter === "todos" || q.status === filter)
    .filter((q) => !code.trim() || (q.number ?? "").toLowerCase().includes(code.trim().toLowerCase()))
    .filter((q) => !clientId || q.client_id === clientId)
    .filter((q) => {
      if (!dFrom && !dTo) return true;
      const d = new Date(q.created_at ?? "");
      if (dFrom && d < dFrom) return false;
      if (dTo && d > new Date(dTo.getTime() + 86400000 - 1)) return false;
      return true;
    })
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  return (
    <Screen>
      <Header title={t("quotes")} subtitle={`${quotes.data?.length ?? 0} registros`} back />
      <Segmented options={[{ value: "todos" as Filter, label: "Todos" }, ...QUOTE_STATUS]} value={filter} onChange={setFilter} />
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        <Row gap={8} style={{ alignItems: "flex-start" }}>
          <Input style={{ flex: 1 }} value={code} onChangeText={setCode} placeholder="Código (ORC-...)" autoCapitalize="characters" testID="quote-filter-code" />
          <View style={{ flex: 1.3 }}>
            <Select value={clientId} options={[{ value: "", label: "Todos os clientes" }, ...(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} onChange={setClientId} placeholder="Cliente" testID="quote-filter-client" />
          </View>
        </Row>
        <Row gap={8}>
          <Input style={{ flex: 1 }} value={from} onChangeText={setFrom} placeholder="De (dd/mm/aaaa)" keyboardType="numbers-and-punctuation" testID="quote-filter-from" />
          <Input style={{ flex: 1 }} value={to} onChangeText={setTo} placeholder="Até (dd/mm/aaaa)" keyboardType="numbers-and-punctuation" testID="quote-filter-to" />
        </Row>
      </View>
      {quotes.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(q) => q.id}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 100, flexGrow: 1 }}
          onRefresh={quotes.refetch}
          refreshing={quotes.isFetching && !quotes.isLoading}
          ListEmptyComponent={
            <Empty
              icon="folder-open-outline"
              title="Nenhum orçamento"
              hint="Crie um orçamento de venda ou serviço e exporte em PDF."
              action={<Button title="Novo orçamento" onPress={() => router.push("/quote/new")} testID="empty-new-quote" />}
            />
          }
          renderItem={({ item: q }) => (
            <Card onPress={() => router.push(`/quote/${q.id}`)} testID={`quote-card-${q.id}`}>
              <View style={styles.row}>
                <Text style={styles.number}>{q.number}</Text>
                <Badge text={q.kind === "servico" ? "Serviço" : "Venda"} tone="brand" />
                <View style={{ flex: 1 }} />
                <Badge text={q.status} tone={STATUS_TONE[q.status] ?? "neutral"} />
              </View>
              <Text style={styles.client}>{q.client_name || "Sem cliente"}</Text>
              <View style={styles.row}>
                <Text style={styles.meta}>
                  {q.items.length} {q.items.length === 1 ? "item" : "itens"} · {fmtDate(q.created_at)}
                </Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.total}>{fmtBRL(quoteTotal(q))}</Text>
              </View>
            </Card>
          )}
        />
      )}
      <Fab onPress={() => router.push("/quote/new")} testID="fab-new-quote" />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  number: { color: c.brandPrimary, fontFamily: fonts.display, fontSize: 16 },
  client: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 17, marginVertical: 4 },
  meta: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
  total: { color: c.onSurface, fontFamily: fonts.display, fontSize: 18 },
}));
