import React, { useEffect, useState } from "react";
import { ActivityIndicator, LogBox, View } from "react-native";
import { Image } from "expo-image";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { AuthProvider, needsOnboarding, useAuth } from "@/src/auth";
import { loadLanguage } from "@/src/i18n";
import { loadThemePreference, makeStyles, useTheme } from "@/src/theme";

LogBox.ignoreAllLogs(true);

const SPLASH_BG = "#0A0A0B"; // mesmo fundo do banner Zatriz (igual no tema claro e escuro)

function Splash() {
  const styles = useStyles();
  return (
    <View style={styles.splash}>
      <Image source={require("../assets/images/zatriz-banner.png")} style={styles.splashLogo} contentFit="contain" testID="splash-logo" />
      <ActivityIndicator color="#2BE36F" style={{ marginTop: 24 }} />
    </View>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const first = segments[0] as string | undefined;
    const publicRoute = first === "login" || first === "register" || first === "forgot";
    const onboardingRoute = first === "onboarding" || first === "billing";
    if (!user && !publicRoute) router.replace("/login");
    else if (user && needsOnboarding(user) && !onboardingRoute) router.replace("/onboarding");
    else if (user && !needsOnboarding(user) && (publicRoute || !first || first === "onboarding")) router.replace("/(tabs)");
  }, [user, loading, segments, router]);

  if (loading) return <Splash />;
  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />;
}

export default function RootLayout() {
  const { colors, scheme } = useTheme();
  const [prefLoaded, setPrefLoaded] = useState(false);
  useEffect(() => {
    Promise.all([loadThemePreference(), loadLanguage()]).finally(() => setPrefLoaded(true));
  }, []);
  const [fontsLoaded] = useFonts({
    Ionicons: require("@react-native-vector-icons/ionicons/fonts/Ionicons.ttf"),
    "Rajdhani-Bold": require("../assets/fonts/Rajdhani-Bold.ttf"),
    "Rajdhani-SemiBold": require("../assets/fonts/Rajdhani-SemiBold.ttf"),
    IBMPlexSans: require("../assets/fonts/IBMPlexSans-Regular.ttf"),
  });

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <StatusBar style={scheme === "dark" ? "light" : "dark"} />
              {fontsLoaded && prefLoaded ? <Gate /> : <Splash />}
            </AuthProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const useStyles = makeStyles((c) => ({
  splash: { flex: 1, backgroundColor: SPLASH_BG, alignItems: "center", justifyContent: "center" },
  splashLogo: { width: "100%", aspectRatio: 3.2 },
}));
