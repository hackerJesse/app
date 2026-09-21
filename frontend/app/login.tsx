import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useT } from "@/src/i18n";
import { Button, Input } from "@/src/components/ui";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const HERO =
  "https://images.unsplash.com/photo-1695668548342-c0c1ad479aee?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function LoginScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, loginBiometric, hasBiometricToken } = useAuth();
  const t = useT();
  const [bioAvailable, setBioAvailable] = useState(false);
  useEffect(() => {
    hasBiometricToken().then(setBioAvailable);
  }, [hasBiometricToken]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const branding = useQuery<{ company_name: string; logo_data_url: string; login_image_url: string }>({ queryKey: ["branding"], queryFn: () => api("/branding", { auth: false }), staleTime: 300000 });

  const submit = async () => {
    if (!email.trim() || !password) {
      setError(t("fillEmailPassword"));
      return;
    }
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao entrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Image source={{ uri: branding.data?.login_image_url || HERO }} style={styles.hero} contentFit="cover" transition={300} />
      <LinearGradient colors={["transparent", colors.surface, colors.surface]} locations={[0, 0.55, 1]} style={styles.scrim} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {branding.data?.logo_data_url ? (
            <Image source={{ uri: branding.data.logo_data_url }} style={styles.logo} contentFit="contain" />
          ) : (
            <Text style={[styles.brand, { textAlign: "center" }]}>{branding.data?.company_name || "ZATRIZ"}</Text>
          )}
          <Text style={[styles.tag, { textAlign: "center" }]}>{t("restricted")}</Text>

          <View style={styles.form}>
            <Input
              testID="login-email"
              label={t("email")}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="voce@empresa.com.br"
            />
            <Input
              testID="login-password"
              label={t("password")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              onSubmitEditing={submit}
              returnKeyType="go"
            />
            {error ? (
              <Text testID="login-error" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <Button testID="login-submit" title={t("signIn")} onPress={submit} loading={busy} icon="log-in-outline" />
            {bioAvailable ? (
              <Button
                testID="login-biometric"
                title={t("signInBiometric")}
                icon="finger-print-outline"
                variant="secondary"
                onPress={async () => {
                  const ok = await loginBiometric();
                  if (!ok) setError("Biometria não reconhecida. Entre com e-mail e senha.");
                }}
              />
            ) : null}
            <Button testID="login-forgot" title={t("forgotPassword")} onPress={() => router.push({ pathname: "/forgot", params: { email: email.trim() } })} variant="ghost" icon="key-outline" />
            <Button testID="login-register" title={t("createAccount")} onPress={() => router.push("/register")} variant="ghost" icon="person-add-outline" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  hero: { position: "absolute", top: 0, left: 0, right: 0, height: "45%" },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, height: "50%" },
  content: { flexGrow: 1, paddingHorizontal: 20, justifyContent: "center" },
  brand: { color: c.onSurface, fontFamily: fonts.display, fontSize: 36, letterSpacing: 2, marginTop: 24 },
  logo: { width: "100%", height: 80, alignSelf: "center", marginBottom: 8, marginTop: 16 },
  tag: { color: c.muted, fontFamily: fonts.displayMedium, fontSize: 12, letterSpacing: 3, marginBottom: 20 },
  form: { gap: 12 },
  error: { color: c.error, fontFamily: fonts.text, fontSize: 13 },
}));
