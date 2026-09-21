import React, { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { MainMenu } from "@/src/components/main-menu";
import { registerMenuOpener } from "@/src/components/ui";
import { useTheme } from "@/src/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName; hidden?: boolean }[] = [
  { name: "index", title: "Início", icon: "speedometer-outline", iconActive: "speedometer" },
  { name: "devices", title: "Dispositivos", icon: "hardware-chip-outline", iconActive: "hardware-chip" },
  { name: "map", title: "Servidores", icon: "map-outline", iconActive: "map" },
  { name: "quotes", title: "Orçamentos", icon: "document-text-outline", iconActive: "document-text", hidden: true },
  { name: "infra", title: "Infra", icon: "server-outline", iconActive: "server", hidden: true },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    registerMenuOpener(() => setMenu(true));
    return () => registerMenuOpener(null);
  }, []);
  return (
    <>
    <MainMenu visible={menu} onClose={() => setMenu(false)} />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { display: "none" },
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            href: t.hidden ? null : undefined,
            tabBarButtonTestID: `tab-${t.name}`,
            tabBarIcon: ({ color, focused, size }) => <Ionicons name={focused ? t.iconActive : t.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
    </>
  );
}
