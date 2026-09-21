import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api } from "@/src/api";
import { Button, Header, Input, Screen, notify } from "@/src/components/ui";
import { fonts, makeStyles } from "@/src/theme";
import { tr } from "@/src/i18n";

export default function ForgotPassword() {
  const styles = useStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async () => {
    if (!email.trim()) return setError(tr("Informe o e-mail da conta."));
    setError("");
    setBusy(true);
    try {
      await api("/auth/forgot-password", { method: "POST", body: { email: email.trim() }, auth: false });
      setStep("code");
      notify(tr("Código enviado"), tr("Se o e-mail estiver cadastrado, você receberá um código de 6 dígitos."));
    } catch (e: any) {
      setError(e?.message ?? "Falha ao enviar código");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (code.trim().length !== 6) return setError(tr("Informe o código de 6 dígitos recebido por e-mail."));
    if (password.length < 6) return setError(tr("A nova senha deve ter pelo menos 6 caracteres."));
    if (password !== confirm) return setError(tr("As senhas não coincidem."));
    setError("");
    setBusy(true);
    try {
      await api("/auth/reset-password", { method: "POST", body: { email: email.trim(), code: code.trim(), new_password: password }, auth: false });
      notify(tr("Senha redefinida"), tr("Entre com a nova senha."));
      router.replace("/login");
    } catch (e: any) {
      setError(e?.message ?? "Falha ao redefinir senha");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={tr("Redefinir senha")} back />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          {step === "email" ? (
            <>
              <Text style={styles.hint}>{tr("Informe o e-mail da sua conta. Enviaremos um código de 6 dígitos para você criar uma nova senha.")}</Text>
              <Input label={tr("E-mail")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="voce@empresa.com.br" testID="forgot-email" />
              {error ? <Text style={styles.error} testID="forgot-error">{error}</Text> : null}
              <Button title={tr("Enviar código")} icon="mail-outline" onPress={sendCode} loading={busy} testID="forgot-send" />
            </>
          ) : (
            <>
              <Text style={styles.hint}>Digite o código recebido em {email} e escolha a nova senha. O código vale por 15 minutos.</Text>
              <Input label={tr("Código (6 dígitos)")} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="000000" testID="forgot-code" />
              <Input label={tr("Nova senha")} value={password} onChangeText={setPassword} secureTextEntry placeholder={tr("mínimo 6 caracteres")} testID="forgot-password" />
              <Input label={tr("Confirmar nova senha")} value={confirm} onChangeText={setConfirm} secureTextEntry placeholder={tr("repita a senha")} onSubmitEditing={reset} returnKeyType="go" testID="forgot-confirm" />
              {error ? <Text style={styles.error} testID="forgot-error">{error}</Text> : null}
              <Button title={tr("Redefinir senha")} icon="key-outline" onPress={reset} loading={busy} testID="forgot-reset" />
              <Button title={tr("Reenviar código")} variant="ghost" onPress={sendCode} loading={busy} testID="forgot-resend" />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  hint: { color: c.muted, fontFamily: fonts.text, fontSize: 13, lineHeight: 19 },
  error: { color: c.error, fontFamily: fonts.text, fontSize: 13 },
}));
