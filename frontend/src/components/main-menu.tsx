import React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Linking } from "react-native";

import { Image } from "expo-image";

import { useAuth } from "@/src/auth";
import { useSettings } from "@/src/brand";
import { TKey, useT } from "@/src/i18n";
import { Icon, Sheet, confirmAsync } from "@/src/components/ui";
import { fonts, makeStyles, useTheme } from "@/src/theme";

type IconName = React.ComponentProps<typeof Icon>["name"];

const ITEMS: { label: TKey; hint: TKey; icon: IconName; href: string; testID: string; admin?: boolean }[] = [
  { label: "home", hint: "hint_home", icon: "speedometer-outline", href: "/(tabs)", testID: "menu-home" },
  { label: "devices", hint: "hint_devices", icon: "hardware-chip-outline", href: "/(tabs)/devices", testID: "menu-devices" },
  { label: "scanQr", hint: "hint_scan", icon: "qr-code-outline", href: "/scan", testID: "menu-scan" },
  { label: "quotes", hint: "hint_quotes", icon: "document-text-outline", href: "/(tabs)/quotes", testID: "menu-quotes" },
  { label: "clients", hint: "hint_clients", icon: "people-outline", href: "/clients", testID: "menu-clients" },
  { label: "infra", hint: "hint_infra", icon: "server-outline", href: "/(tabs)/infra", testID: "menu-infra" },
  { label: "servers", hint: "hint_servers", icon: "map-outline", href: "/(tabs)/map", testID: "menu-map" },
  { label: "settings", hint: "hint_settings", icon: "settings-outline", href: "/settings", testID: "menu-settings" },
  { label: "subscribers", hint: "hint_subscribers", icon: "card-outline", href: "/admin/subscribers", testID: "menu-subscribers", admin: true },
];

export function MainMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();
  const settings = useSettings();
  const t = useT();

  const go = (href: string) => {
    onClose();
    setTimeout(() => router.push(href as any), 50);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={settings.data?.company_name || "N-Security InfraManager"}>
      <View style={styles.profile}>
        {settings.data?.logo_data_url ? (
          <Image source={{ uri: settings.data.logo_data_url }} style={styles.logo} contentFit="contain" />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user?.name || user?.email}</Text>
          <Text style={styles.role}>{user?.role === "admin" ? t("admin") : t("user")} · {user?.email}</Text>
        </View>
      </View>
      {ITEMS.filter((it) => !it.admin || user?.role === "admin").map((it) => (
        <Pressable key={it.href} testID={it.testID} onPress={() => go(it.href)} style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}>
          <View style={styles.itemIcon}>
            <Icon name={it.icon} size={20} color={colors.brandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemLabel}>{t(it.label)}</Text>
            <Text style={styles.itemHint}>{t(it.hint)}</Text>
          </View>
          <Icon name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
      ))}
      {[
        { key: "pdf", url: settings.data?.tutorial_pdf_url, label: "Tutorial em PDF", icon: "book-outline" as const },
        { key: "video", url: settings.data?.tutorial_video_url, label: "Tutorial em vídeo", icon: "play-circle-outline" as const },
      ]
        .filter((x) => !!x.url)
        .map((x) => (
          <Pressable key={x.key} testID={`menu-tutorial-${x.key}`} onPress={() => { onClose(); Linking.openURL(x.url!); }} style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}>
            <View style={styles.itemIcon}>
              <Icon name={x.icon} size={20} color={colors.brandPrimary} />
            </View>
            <Text style={[styles.itemLabel, { flex: 1 }]}>{x.label}</Text>
            <Icon name="open-outline" size={16} color={colors.muted} />
          </Pressable>
        ))}
      <Pressable
        testID="menu-logout"
        onPress={async () => {
          if (await confirmAsync(t("logout"), t("logoutConfirm"))) {
            onClose();
            await logout();
          }
        }}
        style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
      >
        <View style={styles.itemIcon}>
          <Icon name="log-out-outline" size={20} color={colors.error} />
        </View>
        <Text style={[styles.itemLabel, { color: colors.error }]}>{t("logout")}</Text>
      </Pressable>
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  profile: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: c.border, marginBottom: 4 },
  logo: { width: 56, height: 40 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: c.onBrandTertiary, fontFamily: fonts.display, fontSize: 18 },
  name: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 16 },
  role: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 4 },
  itemIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  itemLabel: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 15 },
  itemHint: { color: c.muted, fontFamily: fonts.text, fontSize: 11 },
}));
