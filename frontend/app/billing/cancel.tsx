import React from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Button, Icon, Screen } from "@/src/components/ui";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { tr } from "@/src/i18n";

export default function BillingCancel() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.center}>
        <Icon name="close-circle-outline" size={64} color={colors.error} />
        <Text style={styles.title}>{tr("Pagamento cancelado")}</Text>
        <Text style={styles.hint}>{tr("Nenhuma cobrança foi realizada. Você pode escolher o plano novamente quando quiser.")}</Text>
        <Button title={tr("Voltar aos planos")} onPress={() => router.replace("/onboarding")} />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
  title: { color: c.onSurface, fontFamily: fonts.display, fontSize: 22 },
  hint: { color: c.muted, fontFamily: fonts.text, fontSize: 13, textAlign: "center" },
}));
