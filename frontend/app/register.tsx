import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/auth";
import { Button, Header, Input, Row, Screen } from "@/src/components/ui";
import { fonts, makeStyles } from "@/src/theme";
import { tr } from "@/src/i18n";

export default function RegisterScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { register } = useAuth();
  const [f, setF] = useState({ full_name: "", email: "", password: "", cpf: "", phone: "", address: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.full_name.trim() || !f.email.trim() || !f.password || !f.cpf.trim() || !f.address.trim()) {
      setError(tr("Preencha nome completo, e-mail, senha, CPF e endereço."));
      return;
    }
    setError("");
    setBusy(true);
    try {
      await register(f);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar conta");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={tr("Criar conta")} subtitle={tr("Dados para o contrato de assinatura")} back />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Input label={tr("Nome completo *")} value={f.full_name} onChangeText={set("full_name")} testID="reg-name" />
          <Input label={tr("E-mail *")} value={f.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" testID="reg-email" />
          <Input label={tr("Senha * (mín. 6 caracteres)")} value={f.password} onChangeText={set("password")} secureTextEntry testID="reg-password" />
          <Row gap={8}>
            <Input style={{ flex: 1 }} label="CPF *" value={f.cpf} onChangeText={set("cpf")} keyboardType="number-pad" placeholder="000.000.000-00" testID="reg-cpf" />
            <Input style={{ flex: 1 }} label={tr("Telefone")} value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" testID="reg-phone" />
          </Row>
          <Input label={tr("Endereço completo *")} value={f.address} onChangeText={set("address")} placeholder={tr("Rua, nº, bairro, cidade - UF, CEP")} testID="reg-address" />
          {error ? <Text style={styles.error} testID="reg-error">{error}</Text> : null}
          <Button title={tr("Criar conta e continuar")} icon="person-add-outline" onPress={submit} loading={busy} testID="reg-submit" />
          <Text style={styles.hint}>{tr("Após criar a conta você aceitará o contrato e escolherá o plano: R$ 25,90/mês por usuário ou licença vitalícia por R$ 999,00 (de R$ 1.500,00).")}</Text>
          <Button title={tr("Já tenho conta")} variant="ghost" onPress={() => router.replace("/login")} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  error: { color: c.error, fontFamily: fonts.text, fontSize: 13 },
  hint: { color: c.muted, fontFamily: fonts.text, fontSize: 12, textAlign: "center" },
}));
