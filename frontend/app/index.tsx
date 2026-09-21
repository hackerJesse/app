import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useTheme } from "@/src/theme";

// The auth gate in app/_layout.tsx redirects from here.
export default function Index() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.brandPrimary} />
    </View>
  );
}
