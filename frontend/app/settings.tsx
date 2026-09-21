import React, { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";

import { uploadImage } from "@/src/api";
import { BIO_KEYS, useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LANGS, Lang, setLanguage, useLanguage, useT } from "@/src/i18n";
import { storage } from "@/src/utils/storage";
import { useSaveSettings, useSettings } from "@/src/brand";
import { Button, Card, Header, Icon, Input, Row, Screen, SectionTitle, Select, notify } from "@/src/components/ui";
import { ThemePreference, fonts, makeStyles, setThemePreference, useTheme, useThemePreference } from "@/src/theme";

const THEMES: { value: ThemePreference; label: "dark" | "light" | "system"; icon: React.ComponentProps<typeof Icon>["name"] }[] = [
  { value: "dark", label: "dark", icon: "moon-outline" },
  { value: "light", label: "light", icon: "sunny-outline" },
  { value: "system", label: "system", icon: "phone-portrait-outline" },
];

export default function SettingsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const pref = useThemePreference();
  const { user, setUser } = useAuth();
  const t = useT();
  const lang = useLanguage();
  const [bio, setBio] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web") return;
    storage.getItem<boolean>(BIO_KEYS.enabled, false).then((v) => setBio(!!v));
    import("expo-local-authentication").then(async (LA) => {
      const hw = await LA.hasHardwareAsync();
      const enrolled = await LA.isEnrolledAsync();
      setBioOk(hw && enrolled);
    });
  }, []);
  const toggleBio = async (v: boolean) => {
    setBio(v);
    await storage.setItem(BIO_KEYS.enabled, v);
    if (!v) await storage.secureRemove(BIO_KEYS.token);
  };
  const changeLang = async (l: Lang) => {
    setLanguage(l);
    try {
      const u = await api("/account/profile", { method: "PUT", body: { language: l } });
      setUser(u);
    } catch {
      /* offline: keeps local preference */
    }
  };
  const settings = useSettings();
  const saveSettings = useSaveSettings();
  const [company, setCompany] = useState("");
  const [latency, setLatency] = useState("300");
  const [pdfUrl, setPdfUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadingBg, setUploadingBg] = useState(false);
  const [smtp, setSmtp] = useState({ smtp_host: "", smtp_port: "587", smtp_user: "", smtp_pass: "", smtp_from: "", alert_email: "", alerts_enabled: false });
  const [testing, setTesting] = useState(false);
  const qc = useQueryClient();
  const operator = useQuery<any>({ queryKey: ["operator"], queryFn: () => api("/account/operator"), enabled: user?.role !== "operator" });
  const [op, setOp] = useState({ name: "", email: "", password: "" });
  const createOp = useMutation({ mutationFn: () => api("/account/operator", { method: "POST", body: op }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["operator"] }); notify("Usuário operador criado"); }, onError: (e: any) => notify("Erro", e?.message) });
  const removeOp = useMutation({ mutationFn: () => api("/account/operator", { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["operator"] }) });
  const [uploading, setUploading] = useState(false);
  const isAdmin = user?.role === "admin";
  const canEdit = user?.role !== "operator"; // assinante edita logo, empresa e e-mail da própria conta

  useEffect(() => {
    if (settings.data) {
      setCompany(settings.data.company_name ?? "");
      setLatency(String(settings.data.latency_warn_ms ?? 300));
      setPdfUrl(settings.data.tutorial_pdf_url ?? "");
      setVideoUrl(settings.data.tutorial_video_url ?? "");
      const d = settings.data;
      setSmtp({ smtp_host: d.smtp_host ?? "", smtp_port: String(d.smtp_port ?? 587), smtp_user: d.smtp_user ?? "", smtp_pass: d.smtp_pass ?? "", smtp_from: d.smtp_from ?? "", alert_email: d.alert_email ?? "", alerts_enabled: !!d.alerts_enabled });
    }
  }, [settings.data]);

  const pickLogo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setUploading(true);
    try {
      const name = a.fileName || (a.mimeType === "image/svg+xml" ? "logo.svg" : "logo.png");
      const path = await uploadImage(a.uri, name, a.mimeType || "image/png");
      await saveSettings.mutateAsync({ ...settings.data, company_name: company, latency_warn_ms: Number(latency) || 300, logo_path: path });
      notify("Logo atualizada", "A nova logo aparecerá no app e nos relatórios.");
    } catch (e: any) {
      notify("Falha ao enviar logo", e?.message);
    } finally {
      setUploading(false);
    }
  };

  const pickLoginImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setUploadingBg(true);
    try {
      const path = await uploadImage(a.uri, a.fileName || "login.jpg", a.mimeType || "image/jpeg");
      await saveSettings.mutateAsync({ ...settings.data, company_name: company, latency_warn_ms: Number(latency) || 300, login_image_path: path });
      notify("Imagem da tela de login atualizada");
    } catch (e: any) {
      notify("Falha ao enviar imagem", e?.message);
    } finally {
      setUploadingBg(false);
    }
  };

  const save = async () => {
    try {
      await saveSettings.mutateAsync({ ...settings.data, company_name: company, latency_warn_ms: Number(latency) || 300, tutorial_pdf_url: pdfUrl.trim(), tutorial_video_url: videoUrl.trim(), ...smtp, smtp_port: Number(smtp.smtp_port) || 587 });
      notify("Configurações salvas");
    } catch (e: any) {
      notify("Erro", e?.message);
    }
  };

  return (
    <Screen>
      <Header title={t("settings")} back />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <SectionTitle title={t("appearance")} />
        <View style={styles.themeRow}>
          {THEMES.map((th) => {
            const active = pref === th.value;
            return (
              <Pressable key={th.value} testID={`theme-${th.value}`} onPress={() => setThemePreference(th.value)} style={[styles.theme, active && styles.themeActive]}>
                <Icon name={th.icon} size={22} color={active ? colors.brandPrimary : colors.muted} />
                <Text style={[styles.themeText, active && { color: colors.onBrandTertiary }]}>{t(th.label)}</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle title={t("language")} />
        <View style={{ paddingHorizontal: 16 }}>
          <Select value={lang} options={LANGS} onChange={changeLang} testID="language-select" />
        </View>

        {Platform.OS !== "web" ? (
          <>
            <SectionTitle title={t("security")} />
            <View style={{ paddingHorizontal: 16 }}>
              <Card>
                <Row>
                  <Icon name="finger-print-outline" size={22} color={colors.brandPrimary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.value}>{t("biometricLogin")}</Text>
                    <Text style={styles.hint}>{bioOk ? t("biometricHint") : t("biometricUnavailable")}</Text>
                  </View>
                  <Switch value={bio} onValueChange={toggleBio} disabled={!bioOk} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} testID="bio-toggle" />
                </Row>
              </Card>
            </View>
          </>
        ) : null}

        <SectionTitle title={t("companyLogo")} />
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <Card>
            <Row gap={12}>
              <View style={styles.logoBox}>
                {settings.data?.logo_data_url ? <Image source={{ uri: settings.data.logo_data_url }} style={{ width: "100%", height: "100%" }} contentFit="contain" /> : <Icon name="image-outline" size={28} color={colors.muted} />}
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.hint}>{isAdmin ? "Logo da empresa: PNG ou SVG sem fundo, recomendado 600 × 200 px (proporção 3:1), até 1 MB. Aparece na tela de login (centralizada), no menu, nas etiquetas e nos relatórios em PDF." : "Logo da sua empresa: PNG ou SVG sem fundo, recomendado 600 × 200 px (3:1), até 1 MB. Sai nos orçamentos, etiquetas e relatórios impressos."}</Text>
                {canEdit ? <Button small title={settings.data?.logo_path ? "Trocar logo" : "Enviar logo"} icon="cloud-upload-outline" variant="secondary" onPress={pickLogo} loading={uploading} testID="upload-logo" /> : <Text style={styles.hint}>Operadores não podem alterar.</Text>}
              </View>
            </Row>
          </Card>
          {isAdmin ? <Button small title="Imagem da tela de login (JPG/PNG 1080 × 1600 px, até 2 MB)" icon="image-outline" variant="secondary" onPress={pickLoginImage} loading={uploadingBg} testID="upload-login-image" /> : null}
          {isAdmin ? (
            <>
              <Input label="Link do tutorial em PDF" value={pdfUrl} onChangeText={setPdfUrl} placeholder="https://.../manual.pdf" autoCapitalize="none" testID="tutorial-pdf" />
              <Input label="Link do tutorial em vídeo" value={videoUrl} onChangeText={setVideoUrl} placeholder="https://youtube.com/..." autoCapitalize="none" testID="tutorial-video" />
            </>
          ) : null}
          <Input label={t("companyName")} value={company} onChangeText={setCompany} placeholder="Minha Empresa" editable={canEdit} testID="company-name" />
          {isAdmin ? <Input label={t("latencyWarn")} value={latency} onChangeText={setLatency} keyboardType="number-pad" testID="latency-warn" /> : null}
          {canEdit ? <Button title={t("saveSettings")} icon="save-outline" onPress={save} loading={saveSettings.isPending} testID="settings-save" /> : null}
        </View>

        <SectionTitle title="Alertas por e-mail (SMTP)" />
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <Text style={styles.hint}>Envia e-mail quando um servidor ficar offline e um resumo diário das preventivas vencidas/próximas. Ex.: Gmail smtp.gmail.com porta 587 (senha de app); Outlook smtp.office365.com 587; porta 465 usa SSL.</Text>
          <Row gap={8}>
            <Input style={{ flex: 2 }} label="Servidor SMTP" value={smtp.smtp_host} onChangeText={(v) => setSmtp({ ...smtp, smtp_host: v })} placeholder="smtp.gmail.com" autoCapitalize="none" editable={canEdit} testID="smtp-host" />
            <Input style={{ flex: 1 }} label="Porta" value={smtp.smtp_port} onChangeText={(v) => setSmtp({ ...smtp, smtp_port: v })} keyboardType="number-pad" editable={canEdit} testID="smtp-port" />
          </Row>
          <Row gap={8}>
            <Input style={{ flex: 1 }} label="Usuário" value={smtp.smtp_user} onChangeText={(v) => setSmtp({ ...smtp, smtp_user: v })} autoCapitalize="none" editable={canEdit} testID="smtp-user" />
            <Input style={{ flex: 1 }} label="Senha" value={smtp.smtp_pass} onChangeText={(v) => setSmtp({ ...smtp, smtp_pass: v })} secureTextEntry editable={canEdit} testID="smtp-pass" />
          </Row>
          <Row gap={8}>
            <Input style={{ flex: 1 }} label="Remetente" value={smtp.smtp_from} onChangeText={(v) => setSmtp({ ...smtp, smtp_from: v })} autoCapitalize="none" placeholder="alertas@empresa.com" editable={canEdit} />
            <Input style={{ flex: 1 }} label="E-mail que recebe alertas" value={smtp.alert_email} onChangeText={(v) => setSmtp({ ...smtp, alert_email: v })} autoCapitalize="none" editable={canEdit} testID="alert-email" />
          </Row>
          <Row>
            <Text style={[styles.value, { flex: 1 }]}>Alertas ativos</Text>
            <Switch value={smtp.alerts_enabled} onValueChange={(v) => setSmtp({ ...smtp, alerts_enabled: v })} disabled={!canEdit} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} testID="alerts-toggle" />
          </Row>
          {canEdit ? (
            <Row gap={8}>
              <Button small title="Salvar e-mail" icon="save-outline" onPress={save} loading={saveSettings.isPending} testID="smtp-save" />
              <Button
                small
                title="Enviar teste"
                icon="mail-outline"
                variant="secondary"
                loading={testing}
                testID="smtp-test"
                onPress={async () => {
                  setTesting(true);
                  try {
                    await save();
                    await api("/settings/test-email", { method: "POST" });
                    notify("E-mail de teste enviado");
                  } catch (e: any) {
                    notify("Falha", e?.message);
                  } finally {
                    setTesting(false);
                  }
                }}
              />
            </Row>
          ) : null}
        </View>

        {user?.role !== "operator" ? (
          <>
            <SectionTitle title="Usuário operador (1 por licença)" />
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              <Text style={styles.hint}>O operador pode cadastrar e editar dispositivos, servidores, preventivas e corretivas, mas não pode excluir registros nem alterar configurações.</Text>
              {operator.data ? (
                <Card>
                  <Row>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.value}>{operator.data.name}</Text>
                      <Text style={styles.hint}>{operator.data.email}</Text>
                    </View>
                    <Button small title="Remover" variant="danger" onPress={() => removeOp.mutate()} testID="operator-remove" />
                  </Row>
                </Card>
              ) : (
                <>
                  <Input label="Nome" value={op.name} onChangeText={(v) => setOp({ ...op, name: v })} testID="operator-name" />
                  <Row gap={8}>
                    <Input style={{ flex: 1 }} label="E-mail" value={op.email} onChangeText={(v) => setOp({ ...op, email: v })} autoCapitalize="none" testID="operator-email" />
                    <Input style={{ flex: 1 }} label="Senha" value={op.password} onChangeText={(v) => setOp({ ...op, password: v })} secureTextEntry testID="operator-password" />
                  </Row>
                  <Button small title="Criar operador" icon="person-add-outline" onPress={() => createOp.mutate()} loading={createOp.isPending} testID="operator-create" />
                </>
              )}
            </View>
          </>
        ) : null}

        <SectionTitle title={t("account")} />
        <View style={{ paddingHorizontal: 16 }}>
          <Card style={{ gap: 4 }}>
            <Text style={styles.value}>{user?.name || "—"}</Text>
            <Text style={styles.hint}>{user?.email}</Text>
            <Text style={styles.hint}>{user?.role === "admin" ? t("admin") : t("user")}</Text>
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  themeRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  theme: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary },
  themeActive: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  themeText: { color: c.muted, fontFamily: fonts.displayMedium, fontSize: 13 },
  logoBox: { width: 96, height: 72, borderRadius: 10, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  hint: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
  value: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 16 },
}));
