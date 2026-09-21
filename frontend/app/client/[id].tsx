import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { Linking } from "react-native";

import { fileUrl, uploadImage } from "@/src/api";

import { Button, Header, IconButton, Input, Row, Screen, StickyBar, confirmAsync, notify } from "@/src/components/ui";
import { useItem, useRemove, useSave } from "@/src/hooks";
import { StateCityPicker } from "@/src/components/state-city";
import { useTheme } from "@/src/theme";
import { Client } from "@/src/types";

const EMPTY: Client = { id: "", name: "", company: "", email: "", phone: "", document: "", address: "", state: "", city: "", contract_path: "", notes: "" };

export default function ClientForm() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const { item } = useItem<Client>("clients", isNew ? undefined : id);
  const save = useSave<Client>("clients");
  const remove = useRemove("clients");
  const [c, setC] = useState<Client>(EMPTY);
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const pickContract = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setUploading(true);
    try {
      const path = await uploadImage(a.uri, a.name || "contrato.pdf", "application/pdf");
      setC((p) => ({ ...p, contract_path: path }));
    } catch (e: any) {
      notify("Falha ao anexar contrato", e?.message);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (item) setC(item);
  }, [item]);

  const set = (k: keyof Client) => (v: string) => setC((p) => ({ ...p, [k]: v }));

  const doSave = async () => {
    if (!c.name.trim()) {
      setErr("Nome é obrigatório");
      return;
    }
    setErr("");
    try {
      const body: any = { ...c };
      if (isNew) delete body.id;
      await save.mutateAsync(body);
      router.back();
    } catch (e: any) {
      notify("Erro ao salvar", e?.message);
    }
  };

  const doDelete = async () => {
    if (!(await confirmAsync("Excluir cliente", `Remover ${c.name}?`))) return;
    await remove.mutateAsync(c.id);
    router.back();
  };

  return (
    <Screen>
      <Header
        title={isNew ? "Novo cliente" : c.name || "Cliente"}
        back
        right={!isNew ? <IconButton name="trash-outline" color={colors.error} onPress={doDelete} testID="client-delete" /> : undefined}
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Input label="Nome *" value={c.name} onChangeText={set("name")} error={err} placeholder="Nome do contato ou razão social" testID="client-name" />
          <Input label="Empresa" value={c.company} onChangeText={set("company")} placeholder="Empresa" testID="client-company" />
          <Row gap={8}>
            <Input style={{ flex: 1 }} label="Telefone" value={c.phone} onChangeText={set("phone")} keyboardType="phone-pad" placeholder="(11) 99999-0000" testID="client-phone" />
            <Input style={{ flex: 1 }} label="CNPJ / CPF" value={c.document} onChangeText={set("document")} placeholder="00.000.000/0000-00" testID="client-document" />
          </Row>
          <Input label="E-mail" value={c.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" placeholder="contato@empresa.com.br" testID="client-email" />
          <Input label="Endereço" value={c.address} onChangeText={set("address")} placeholder="Rua, número, bairro" testID="client-address" />
          <StateCityPicker state={c.state} city={c.city} onChange={(v) => setC((p) => ({ ...p, state: v.state, city: v.city }))} testID="client-geo" />
          <Row gap={8}>
            <Button small title={c.contract_path ? "Trocar contrato (PDF)" : "Anexar contrato (PDF)"} icon="document-attach-outline" variant="secondary" onPress={pickContract} loading={uploading} testID="client-contract" />
            {c.contract_path ? <Button small title="Abrir" icon="open-outline" variant="ghost" onPress={() => Linking.openURL(fileUrl(c.contract_path!))} testID="client-contract-open" /> : null}
          </Row>
          <Input label="Observações" value={c.notes} onChangeText={set("notes")} multiline />
        </ScrollView>
      </KeyboardAvoidingView>
      <StickyBar>
        <Button title="Salvar cliente" icon="save-outline" onPress={doSave} loading={save.isPending} style={{ flex: 1 }} testID="client-save" />
      </StickyBar>
    </Screen>
  );
}
