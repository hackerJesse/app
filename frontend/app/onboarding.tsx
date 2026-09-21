import React, { useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { api } from "@/src/api";
import { User, useAuth } from "@/src/auth";
import { Badge, Button, Card, Header, Icon, Input, Row, Screen, notify } from "@/src/components/ui";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const CONTRACT = `CONTRATO DE LICENÇA DE USO — N-SECURITY INFRAMANAGER (v1.0)

1. OBJETO. Licença de uso do aplicativo InfraManager para gestão de infraestrutura de TI (inventário, orçamentos, racks, topologias, plantas e monitoramento).
2. PLANOS. (a) Assinatura mensal de R$ 25,90 por usuário, renovada automaticamente; (b) Licença vitalícia ilimitada por R$ 999,00 à vista (valor cheio R$ 1.500,00 com desconto de R$ 501,00).
3. ACESSO. O acesso é liberado após a confirmação do primeiro pagamento. Cada usuário pode manter apenas um dispositivo conectado por vez; um novo login encerra a sessão anterior.
4. INADIMPLÊNCIA. Na assinatura mensal, a ausência de pagamento bloqueia automaticamente o acesso até a regularização, sem exclusão dos dados por 90 dias.
5. DADOS. Os dados cadastrados pertencem ao CONTRATANTE. A CONTRATADA adota medidas de segurança e mascaramento de dados sensíveis (hosts, portas, redes).
6. SUPORTE E ATUALIZAÇÕES. Incluídos durante a vigência da assinatura ou, na licença vitalícia, por 12 meses para novas funcionalidades e sem prazo para correções.
7. ACEITE. O aceite eletrônico (nome completo, CPF, data/hora e endereço IP) tem validade jurídica nos termos da legislação brasileira (MP 2.200-2/2001 e Lei 14.063/2020).`;

export default function OnboardingScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { user, setUser, refreshUser, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [cpf, setCpf] = useState(user?.cpf ?? "");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const acceptContract = async () => {
    if (!agree) {
      notify("Marque a caixa de aceite do contrato");
      return;
    }
    setBusy("contract");
    try {
      const u = await api<User>("/account/contract", { method: "POST", body: { accept: true, full_name: name, cpf } });
      setUser(u);
    } catch (e: any) {
      notify("Erro", e?.message);
    } finally {
      setBusy(null);
    }
  };

  const checkout = async (plan: "monthly" | "lifetime") => {
    setBusy(plan);
    try {
      const origin = Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : process.env.EXPO_PUBLIC_BACKEND_URL ?? "";
      const data = await api<{ url: string }>("/billing/checkout", { method: "POST", body: { plan, origin } });
      if (Platform.OS === "web") window.location.assign(data.url);
      else {
        await WebBrowser.openBrowserAsync(data.url);
        await verify();
      }
    } catch (e: any) {
      notify("Erro ao iniciar pagamento", e?.message);
    } finally {
      setBusy(null);
    }
  };

  const verify = async () => {
    setBusy("verify");
    try {
      const data = await api<{ user: User }>("/billing/me");
      setUser(data.user);
      if (!data.user.has_access) notify("Pagamento ainda não confirmado", "Conclua o pagamento e toque em verificar novamente.");
    } finally {
      setBusy(null);
    }
  };

  const contractDone = !!user?.contract_accepted_at;

  return (
    <Screen>
      <Header title="Ativação da conta" subtitle={user?.email} right={<Button small title="Sair" variant="ghost" onPress={logout} testID="onb-logout" />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Row gap={8}>
          <Badge text={contractDone ? "1 · Contrato aceito" : "1 · Contrato"} tone={contractDone ? "success" : "brand"} />
          <Badge text={user?.has_access ? "2 · Pago" : "2 · Pagamento"} tone={user?.has_access ? "success" : "neutral"} />
        </Row>

        {!contractDone ? (
          <Card style={{ gap: 10 }}>
            <Text style={styles.title}>Contrato de assinatura</Text>
            <ScrollView style={styles.contractBox} nestedScrollEnabled>
              <Text style={styles.contract}>{CONTRACT}</Text>
            </ScrollView>
            <Input label="Nome completo" value={name} onChangeText={setName} testID="onb-name" />
            <Input label="CPF" value={cpf} onChangeText={setCpf} keyboardType="number-pad" testID="onb-cpf" />
            <Pressable onPress={() => setAgree((a) => !a)} style={styles.check} testID="onb-agree">
              <Icon name={agree ? "checkbox" : "square-outline"} size={22} color={agree ? colors.brandPrimary : colors.muted} />
              <Text style={styles.checkText}>Li e aceito o contrato. Serão registrados nome, CPF, data/hora e IP do aceite.</Text>
            </Pressable>
            <Button title="Aceitar contrato" icon="checkmark-circle-outline" onPress={acceptContract} loading={busy === "contract"} testID="onb-accept" />
          </Card>
        ) : (
          <>
            <Text style={styles.title}>Escolha o plano</Text>
            <Card style={{ gap: 6 }} testID="plan-monthly">
              <Row>
                <Text style={styles.planName}>Assinatura mensal</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.price}>R$ 25,90</Text>
                <Text style={styles.per}>/mês por usuário</Text>
              </Row>
              <Text style={styles.hint}>Renovação automática · cancele quando quiser · bloqueio automático em caso de não pagamento.</Text>
              <Button title="Assinar mensal" icon="card-outline" onPress={() => checkout("monthly")} loading={busy === "monthly"} testID="buy-monthly" />
            </Card>
            <Card style={{ gap: 6, borderColor: colors.brandPrimary }} testID="plan-lifetime">
              <Row>
                <Text style={styles.planName}>Licença vitalícia ilimitada</Text>
                <View style={{ flex: 1 }} />
                <Badge text="-R$ 501" tone="success" />
              </Row>
              <Row gap={8}>
                <Text style={styles.strike}>R$ 1.500,00</Text>
                <Text style={styles.price}>R$ 999,00</Text>
                <Text style={styles.per}>à vista</Text>
              </Row>
              <Text style={styles.hint}>Pagamento único · usuários ilimitados · atualizações por 12 meses e correções sem prazo.</Text>
              <Button title="Comprar licença vitalícia" icon="ribbon-outline" onPress={() => checkout("lifetime")} loading={busy === "lifetime"} testID="buy-lifetime" />
            </Card>
            <Button title="Já paguei — verificar" icon="refresh-outline" variant="secondary" onPress={verify} loading={busy === "verify"} testID="verify-payment" />
            <Text style={styles.hint}>Pagamento seguro via Stripe (cartão). O acesso é liberado automaticamente após a confirmação.</Text>
          </>
        )}
        <Button title="Atualizar status" variant="ghost" onPress={() => refreshUser().then((u) => u?.has_access && router.replace("/(tabs)"))} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  title: { color: c.onSurface, fontFamily: fonts.display, fontSize: 20 },
  contractBox: { maxHeight: 220, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 10, backgroundColor: c.surface },
  contract: { color: c.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12, lineHeight: 18 },
  check: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkText: { flex: 1, color: c.onSurface, fontFamily: fonts.text, fontSize: 13 },
  planName: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 16 },
  price: { color: c.brandPrimary, fontFamily: fonts.display, fontSize: 24 },
  per: { color: c.muted, fontFamily: fonts.text, fontSize: 11 },
  strike: { color: c.muted, fontFamily: fonts.text, fontSize: 14, textDecorationLine: "line-through" },
  hint: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
}));
