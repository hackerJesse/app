import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { api } from "@/src/api";
import { User, useAuth } from "@/src/auth";
import { Button, Icon, Screen } from "@/src/components/ui";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export default function BillingSuccess() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { session_id } = useLocalSearchParams<{ session_id: string }>();
  const { setUser } = useAuth();
  const [status, setStatus] = useState<"checking" | "paid" | "pending">("checking");

  useEffect(() => {
    let tries = 0;
    let stop = false;
    const poll = async () => {
      try {
        const d = await api<{ status: string; user: User }>(`/billing/status/${session_id}`);
        if (d.status === "paid") {
          setUser(d.user);
          setStatus("paid");
          return;
        }
      } catch {
        /* retry */
      }
      if (!stop && tries++ < 5) setTimeout(poll, 2000);
      else setStatus("pending");
    };
    if (session_id) poll();
    return () => {
      stop = true;
    };
  }, [session_id, setUser]);

  return (
    <Screen>
      <View style={styles.center}>
        {status === "checking" ? <ActivityIndicator color={colors.brandPrimary} size="large" /> : <Icon name={status === "paid" ? "checkmark-circle" : "time-outline"} size={64} color={status === "paid" ? colors.success : colors.warning} />}
        <Text style={styles.title}>{status === "checking" ? "Confirmando pagamento..." : status === "paid" ? "Pagamento confirmado!" : "Pagamento em processamento"}</Text>
        <Text style={styles.hint}>{status === "paid" ? "Sua conta está ativa. Bem-vindo ao InfraManager." : "Assim que o Stripe confirmar, seu acesso será liberado automaticamente."}</Text>
        <Button title={status === "paid" ? "Entrar no app" : "Voltar"} onPress={() => router.replace(status === "paid" ? "/(tabs)" : "/onboarding")} testID="billing-continue" />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
  title: { color: c.onSurface, fontFamily: fonts.display, fontSize: 22, textAlign: "center" },
  hint: { color: c.muted, fontFamily: fonts.text, fontSize: 13, textAlign: "center" },
}));
