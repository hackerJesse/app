import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Badge, Button, Card, Header, IconButton, Input, Row, Screen, SectionTitle, Select, Sheet, StickyBar, confirmAsync, notify } from "@/src/components/ui";
import { useItem, useList, useRemove, useSave } from "@/src/hooks";
import { canSharePdf, printHtml, quoteHtml, sharePdf } from "@/src/pdf";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { Client, QUOTE_STATUS, Quote, QuoteItem, STATUS_TONE, fmtBRL, quoteSubtotal, quoteTotal } from "@/src/types";

const EMPTY: Quote = { id: "", kind: "venda", status: "rascunho", items: [], discount: 0, tax: 0, notes: "", valid_until: "", client_id: "", client_name: "" };

function num(v: string) {
  const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function QuoteEditor() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const { item, isLoading } = useItem<Quote>("quotes", isNew ? undefined : id);
  const clients = useList<Client>("clients");
  const save = useSave<Quote>("quotes");
  const remove = useRemove("quotes");

  const [q, setQ] = useState<Quote>(EMPTY);
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [itemSheet, setItemSheet] = useState<{ index: number; item: QuoteItem } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (item) {
      setQ(item);
      setDiscount(String(item.discount ?? 0));
      setTax(String(item.tax ?? 0));
    }
  }, [item]);

  const patch = (p: Partial<Quote>) => {
    setQ((prev) => ({ ...prev, ...p }));
    setDirty(true);
  };

  const current: Quote = { ...q, discount: num(discount), tax: num(tax) };
  const client = clients.data?.find((c) => c.id === q.client_id);

  const doSave = async () => {
    if (!current.client_id && !current.client_name) {
      notify("Selecione um cliente");
      return;
    }
    try {
      const body: any = { ...current };
      if (isNew) delete body.id;
      const saved = await save.mutateAsync(body);
      setDirty(false);
      if (isNew) router.replace(`/quote/${saved.id}`);
      else notify("Orçamento salvo");
    } catch (e: any) {
      notify("Erro ao salvar", e?.message);
    }
  };

  const doDelete = async () => {
    if (!(await confirmAsync("Excluir orçamento", "Esta ação não pode ser desfeita."))) return;
    await remove.mutateAsync(q.id);
    router.back();
  };

  const exportPdf = async (share: boolean) => {
    try {
      const html = quoteHtml(current, client);
      if (share) await sharePdf(html, `${current.number || "orcamento"}.pdf`);
      else await printHtml(html);
    } catch (e: any) {
      notify("Falha ao gerar PDF", e?.message);
    }
  };

  const saveItem = () => {
    if (!itemSheet) return;
    if (!itemSheet.item.description.trim()) {
      notify("Informe a descrição do item");
      return;
    }
    const items = [...q.items];
    if (itemSheet.index === -1) items.push(itemSheet.item);
    else items[itemSheet.index] = itemSheet.item;
    patch({ items });
    setItemSheet(null);
  };

  const removeItem = (idx: number) => patch({ items: q.items.filter((_, i) => i !== idx) });

  if (!isNew && isLoading) return <Screen><Header title="Orçamento" back /></Screen>;

  return (
    <Screen>
      <Header
        title={isNew ? "Novo orçamento" : q.number || "Orçamento"}
        subtitle={q.client_name || undefined}
        back
        right={!isNew ? <IconButton name="trash-outline" color={colors.error} onPress={doDelete} testID="quote-delete" /> : undefined}
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Row gap={8} style={{ flexWrap: "wrap" }}>
            <Badge text={q.status} tone={STATUS_TONE[q.status]} />
            <Badge text={q.kind === "servico" ? "Serviço" : "Venda"} tone="brand" />
          </Row>
          <Select
            testID="quote-client"
            label="Cliente"
            value={q.client_id ?? ""}
            options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name, hint: c.company }))}
            onChange={(v) => patch({ client_id: v, client_name: clients.data?.find((c) => c.id === v)?.name ?? "" })}
            placeholder={clients.data?.length ? "Selecionar cliente" : "Cadastre um cliente primeiro"}
          />
          <Row gap={8}>
            <View style={{ flex: 1 }}>
              <Select
                testID="quote-kind"
                label="Tipo"
                value={q.kind}
                options={[
                  { value: "venda", label: "Venda" },
                  { value: "servico", label: "Serviço" },
                ]}
                onChange={(v) => patch({ kind: v })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Select testID="quote-status" label="Status" value={q.status} options={QUOTE_STATUS} onChange={(v) => patch({ status: v })} />
            </View>
          </Row>
          <Input label="Validade" value={q.valid_until} onChangeText={(v) => patch({ valid_until: v })} placeholder="dd/mm/aaaa" testID="quote-valid" />

          <SectionTitle
            title={`Itens (${q.items.length})`}
            right={
              <Button
                small
                title="Adicionar"
                icon="add"
                variant="ghost"
                testID="quote-add-item"
                onPress={() => setItemSheet({ index: -1, item: { description: "", quantity: 1, unit_price: 0, detail: "" } })}
              />
            }
          />
          {q.items.length === 0 ? <Text style={styles.hint}>Nenhum item. Adicione produtos ou serviços.</Text> : null}
          {q.items.map((it, idx) => (
            <Card key={idx} onPress={() => setItemSheet({ index: idx, item: { ...it } })} testID={`quote-item-${idx}`}>
              <Row>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{it.description}</Text>
                  {it.detail ? <Text style={styles.hint}>{it.detail}</Text> : null}
                  <Text style={styles.hint}>
                    {it.quantity} × {fmtBRL(it.unit_price)}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>{fmtBRL(it.quantity * it.unit_price)}</Text>
                <IconButton name="close" size={18} color={colors.muted} onPress={() => removeItem(idx)} />
              </Row>
            </Card>
          ))}

          <Row gap={8}>
            <Input style={{ flex: 1 }} label="Desconto (R$)" value={discount} onChangeText={(v) => { setDiscount(v); setDirty(true); }} keyboardType="decimal-pad" testID="quote-discount" />
            <Input style={{ flex: 1 }} label="Impostos (R$)" value={tax} onChangeText={(v) => { setTax(v); setDirty(true); }} keyboardType="decimal-pad" testID="quote-tax" />
          </Row>
          <Input label="Observações" value={q.notes} onChangeText={(v) => patch({ notes: v })} multiline placeholder="Condições de pagamento, prazo de entrega, garantia..." />

          <Card style={{ gap: 4 }}>
            <Row>
              <Text style={styles.totLabel}>Subtotal</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.totValue}>{fmtBRL(quoteSubtotal(current))}</Text>
            </Row>
            <Row>
              <Text style={styles.totLabel}>Desconto</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.totValue}>- {fmtBRL(current.discount)}</Text>
            </Row>
            <Row>
              <Text style={styles.totLabel}>Impostos</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.totValue}>{fmtBRL(current.tax)}</Text>
            </Row>
            <View style={styles.divider} />
            <Row>
              <Text style={styles.grandLabel}>TOTAL</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.grand} testID="quote-total">{fmtBRL(quoteTotal(current))}</Text>
            </Row>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <StickyBar>
        <Button title={dirty || isNew ? "Salvar" : "Salvo"} icon="save-outline" onPress={doSave} loading={save.isPending} style={{ flex: 1 }} testID="quote-save" disabled={!dirty && !isNew} />
        <Button title="Imprimir" icon="print-outline" variant="secondary" onPress={() => exportPdf(false)} testID="quote-print" />
        {canSharePdf ? <Button title="PDF" icon="share-outline" variant="secondary" onPress={() => exportPdf(true)} testID="quote-share" /> : null}
      </StickyBar>

      <Sheet
        visible={!!itemSheet}
        onClose={() => setItemSheet(null)}
        title={itemSheet?.index === -1 ? "Novo item" : "Editar item"}
        footer={<Button title="Confirmar item" onPress={saveItem} testID="item-confirm" />}
      >
        {itemSheet ? (
          <>
            <Input
              label="Descrição"
              value={itemSheet.item.description}
              onChangeText={(v) => setItemSheet({ ...itemSheet, item: { ...itemSheet.item, description: v } })}
              placeholder="Switch 48 portas PoE / Instalação de rack"
              testID="item-description"
            />
            <Row gap={8}>
              <Input
                style={{ flex: 1 }}
                label="Quantidade"
                value={String(itemSheet.item.quantity)}
                onChangeText={(v) => setItemSheet({ ...itemSheet, item: { ...itemSheet.item, quantity: num(v) } })}
                keyboardType="decimal-pad"
                testID="item-qty"
              />
              <Input
                style={{ flex: 1 }}
                label="Valor unitário (R$)"
                value={String(itemSheet.item.unit_price)}
                onChangeText={(v) => setItemSheet({ ...itemSheet, item: { ...itemSheet.item, unit_price: num(v) } })}
                keyboardType="decimal-pad"
                testID="item-price"
              />
            </Row>
            <Input
              label="Detalhes (opcional)"
              value={itemSheet.item.detail}
              onChangeText={(v) => setItemSheet({ ...itemSheet, item: { ...itemSheet.item, detail: v } })}
              placeholder="Marca, modelo, garantia..."
            />
            <Pressable>
              <Text style={styles.hint}>Total do item: {fmtBRL(itemSheet.item.quantity * itemSheet.item.unit_price)}</Text>
            </Pressable>
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  hint: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
  itemTitle: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 15 },
  itemTotal: { color: c.onSurface, fontFamily: fonts.display, fontSize: 16 },
  totLabel: { color: c.muted, fontFamily: fonts.text, fontSize: 13 },
  totValue: { color: c.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 13 },
  divider: { height: 1, backgroundColor: c.border, marginVertical: 6 },
  grandLabel: { color: c.onSurface, fontFamily: fonts.display, fontSize: 16, letterSpacing: 1 },
  grand: { color: c.brandPrimary, fontFamily: fonts.display, fontSize: 24 },
}));
