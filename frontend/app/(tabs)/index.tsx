import React from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useSettings } from "@/src/brand";
import { useT, tr } from "@/src/i18n";
import { AreaChart, Donut, LegendDot, StackedBars } from "@/src/components/charts";
import { Badge, Card, Icon, IconButton, Screen, SectionTitle, openMainMenu } from "@/src/components/ui";
import { BrazilMap } from "@/src/components/brazil-map";
import { DEVICE_KINDS, Device, Maintenance } from "@/src/devices";
import { useList } from "@/src/hooks";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { Dashboard, Quote, STATUS_TONE, Server, Topology, fmtBRL, quoteTotal } from "@/src/types";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default function DashboardScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const settings = useSettings();
  const t = useT();
  const dash = useQuery<Dashboard>({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard") });
  const quotes = useList<Quote>("quotes");
  const servers = useList<Server>("servers");
  const devices = useList<Device>("devices");
  const topos = useList<Topology>("topologies");
  const maint = useQuery<Maintenance[]>({ queryKey: ["maintenances"], queryFn: () => api<Maintenance[]>("/maintenances") });

  const d = dash.data;
  const warnMs = settings.data?.latency_warn_ms ?? 300;
  const srv = servers.data ?? [];
  const unstable = srv.filter((s) => s.status === "offline" || (s.latency_ms != null && s.latency_ms > warnMs)).length;
  const online = srv.filter((s) => s.status === "online").length;

  // Maintenances per month (last 6 months)
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const dt = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { y: dt.getFullYear(), m: dt.getMonth() };
  });
  const bars = months.map(({ y, m }) => {
    const inMonth = (maint.data ?? []).filter((x) => {
      const dt = new Date(x.date);
      return dt.getFullYear() === y && dt.getMonth() === m;
    });
    return {
      label: MONTHS[m],
      values: [
        { value: inMonth.filter((x) => x.kind === "preventiva").length, color: colors.brandPrimary },
        { value: inMonth.filter((x) => x.kind === "corretiva").length, color: colors.accent },
      ],
    };
  });

  const kindColors = [colors.brandPrimary, colors.brandSecondary, colors.accent, colors.success, colors.warning, colors.onBrandTertiary, colors.muted, colors.borderStrong];
  const byKind = DEVICE_KINDS.map((k, i) => ({ label: k.label, value: (devices.data ?? []).filter((x) => x.kind === k.value).length, color: kindColors[i % kindColors.length] })).filter((x) => x.value > 0);

  const recent = [...(quotes.data ?? [])].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")).slice(0, 3);
  const refresh = () => {
    dash.refetch();
    quotes.refetch();
    servers.refetch();
    devices.refetch();
    maint.refetch();
  };

  const quick: { label: string; icon: React.ComponentProps<typeof Icon>["name"]; href: string; testID: string }[] = [
    { label: "Dispositivo", icon: "add-circle-outline", href: "/device/form", testID: "qa-device" },
    { label: "Ler QR", icon: "qr-code-outline", href: "/scan", testID: "qa-scan" },
    { label: "Orçamento", icon: "document-text-outline", href: "/quote/new", testID: "qa-quote" },
    { label: "Servidor", icon: "hardware-chip-outline", href: "/server/new", testID: "qa-server" },
    { label: "Rack", icon: "server-outline", href: "/rack/new", testID: "qa-rack" },
    { label: "Topologia", icon: "git-network-outline", href: "/topology/new", testID: "qa-topology" },
    { label: "Planta", icon: "map-outline", href: "/floorplan/new", testID: "qa-floorplan" },
    { label: "Clientes", icon: "people-outline", href: "/clients", testID: "qa-clients" },
  ];

  return (
    <Screen>
      <View style={styles.top}>
        <IconButton name="menu-outline" size={26} onPress={openMainMenu} testID="menu-button" />
        {settings.data?.logo_data_url ? (
          <Image source={{ uri: settings.data.logo_data_url }} style={styles.logo} contentFit="contain" />
        ) : (
          <Text style={styles.brand}>
            {settings.data?.company_name || "N-SECURITY"}
          </Text>
        )}
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.push("/settings")} testID="avatar-button">
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={dash.isFetching && !dash.isLoading} onRefresh={refresh} tintColor={colors.brandPrimary} />} contentContainerStyle={{ paddingBottom: 32, gap: 12 }}>
        <Text style={styles.hello}>{t("hello")}, {(user?.name || user?.email || "").split(" ")[0]}</Text>

        {d && (d.preventive_overdue > 0 || d.preventive_soon > 0) ? (
          <Pressable testID="preventive-alert" onPress={() => router.push("/(tabs)/devices?filter=proxima" as any)} style={[styles.alert, { borderColor: d.preventive_overdue > 0 ? colors.error : colors.warning }]}>
            <Icon name="alert-circle-outline" size={22} color={d.preventive_overdue > 0 ? colors.error : colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>{d.preventive_overdue > 0 ? `${d.preventive_overdue} dispositivo(s) com preventiva vencida` : `${d.preventive_soon} preventiva(s) vencendo em até 15 dias`}</Text>
              <Text style={styles.alertHint}>{d.preventive_overdue > 0 && d.preventive_soon > 0 ? `+ ${d.preventive_soon} vencendo nos próximos 15 dias · ` : ""}Toque para ver a lista</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ) : null}

        {/* Hero */}
        <Pressable testID="metric-devices" onPress={() => router.push("/(tabs)/devices")} style={{ marginHorizontal: 16 }}>
          <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>{t("registeredDevices")}</Text>
              <Text style={styles.heroValue}>{d?.devices_total ?? "—"}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                <View style={styles.heroPill} testID="metric-overdue">
                  <Text style={styles.heroPillText}>{d?.preventive_overdue ?? 0} {t("overduePreventive")}</Text>
                </View>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>{d?.preventive_soon ?? 0} {t("upcoming")}</Text>
                </View>
              </View>
            </View>
            <Icon name="hardware-chip-outline" size={56} color={colors.onBrandSecondary} />
          </LinearGradient>
        </Pressable>

        {/* Indicators */}
        <View style={styles.row2}>
          <Card onPress={() => router.push("/(tabs)/map")} style={{ flex: 1 }} testID="metric-servers">
            <Text style={styles.cardLabel}>{t("servers").toUpperCase()}</Text>
            <Text style={[styles.cardValue, { color: unstable ? colors.error : colors.success }]}>{unstable}</Text>
            <Text style={styles.cardSub}>{t("unstable")}</Text>
            <Text style={styles.cardSub}>
              {online} online · {srv.length - online} offline/não verif.
            </Text>
          </Card>
          <Card onPress={() => router.push("/(tabs)/quotes")} style={{ flex: 1 }} testID="metric-pending">
            <Text style={styles.cardLabel}>{t("quotes").toUpperCase()}</Text>
            <Text style={[styles.cardValue, { color: colors.warning }]}>{d?.quotes_pending ?? "—"}</Text>
            <Text style={styles.cardSub}>{t("pending")}</Text>
            <Text style={styles.cardSub}>{d ? `${fmtBRL(d.approved_value)} ${t("approved")}` : ""}</Text>
          </Card>
        </View>

        {/* Maintenance chart */}
        <Card style={{ marginHorizontal: 16, gap: 10 }} testID="chart-maintenance">
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={[styles.cardLabel, { flex: 1 }]}>{t("maintenance6m")}</Text>
            <LegendDot color={colors.brandPrimary} label={t("preventive")} />
            <View style={{ width: 10 }} />
            <LegendDot color={colors.accent} label={t("corrective")} />
          </View>
          <StackedBars data={bars} />
        </Card>

        {/* Devices by kind + latency */}
        <View style={styles.row2}>
          <Card style={{ flex: 1, alignItems: "center", gap: 6 }} testID="chart-kinds">
            <Text style={styles.cardLabel}>{t("byType")}</Text>
            <Donut segments={byKind} label={String(d?.devices_total ?? 0)} sub="dispositivos" />
            <View style={{ gap: 2, alignSelf: "stretch" }}>
              {byKind.slice(0, 4).map((k) => (
                <LegendDot key={k.label} color={k.color} label={`${k.label} (${k.value})`} />
              ))}
            </View>
          </Card>
          <Card onPress={() => router.push("/(tabs)/map")} style={{ flex: 1, gap: 6 }} testID="chart-latency">
            <Text style={styles.cardLabel}>{t("latency")}</Text>
            <AreaChart values={srv.map((s) => s.latency_ms ?? 0)} height={80} />
            <Text style={styles.cardSub}>{srv.length ? `${srv.length} servidor(es) · alerta > ${warnMs} ms` : "Nenhum servidor"}</Text>
          </Card>
        </View>

        {/* Map */}
        <SectionTitle title={t("serverMap")} right={<Pressable onPress={() => router.push("/(tabs)/map")}><Text style={styles.link}>{t("openMap")}</Text></Pressable>} />
        <Pressable onPress={() => router.push("/(tabs)/map")} style={styles.mapCard} testID="dash-map">
          <BrazilMap servers={srv} warnMs={warnMs} />
        </Pressable>

        {/* Topologies */}
        <SectionTitle title={t("topologies")} right={<Pressable onPress={() => router.push("/(tabs)/infra")}><Text style={styles.link}>{t("seeInfra")}</Text></Pressable>} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {(topos.data ?? []).length === 0 ? (
            <Pressable style={styles.topoCard} onPress={() => router.push("/topology/new")} testID="topo-new-card">
              <Icon name="add-circle-outline" size={22} color={colors.brandPrimary} />
              <Text style={styles.topoName}>{tr("Criar topologia")}</Text>
            </Pressable>
          ) : null}
          {(topos.data ?? []).map((t) => (
            <Pressable key={t.id} style={styles.topoCard} onPress={() => router.push(`/topology/${t.id}`)} testID={`topo-card-${t.id}`}>
              <Icon name="git-network-outline" size={22} color={colors.brandPrimary} />
              <Text style={styles.topoName} numberOfLines={1}>
                {t.name}
              </Text>
              <Text style={styles.cardSub}>
                {t.nodes.length} disp. · {t.links.length} links
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Quick actions */}
        <SectionTitle title={t("quickActions")} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {quick.map((a) => (
            <Pressable key={a.href} testID={a.testID} onPress={() => router.push(a.href as any)} style={styles.quick}>
              <Icon name={a.icon} size={18} color={colors.brandPrimary} />
              <Text style={styles.quickText}>{a.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Recent quotes */}
        {recent.length ? (
          <>
            <SectionTitle title={t("recentQuotes")} />
            <View style={{ paddingHorizontal: 16, gap: 8 }}>
              {recent.map((q) => (
                <Card key={q.id} onPress={() => router.push(`/quote/${q.id}`)} testID={`recent-quote-${q.id}`}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.qNum}>
                        {q.number} · {q.client_name || "Sem cliente"}
                      </Text>
                      <Text style={styles.cardSub}>{q.kind === "servico" ? tr("Serviço") : tr("Venda")}</Text>
                    </View>
                    <Text style={styles.qTotal}>{fmtBRL(quoteTotal(q))}</Text>
                    <Badge text={q.status} tone={STATUS_TONE[q.status] ?? "neutral"} />
                  </View>
                </Card>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  top: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, height: 56 },
  logo: { width: 110, height: 34 },
  brand: { color: c.onSurface, fontFamily: fonts.display, fontSize: 20, letterSpacing: 1.5 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceTertiary },
  avatarFallback: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.brandPrimary },
  avatarText: { color: c.brandPrimary, fontFamily: fonts.display, fontSize: 16 },
  hello: { color: c.muted, fontFamily: fonts.text, fontSize: 13, paddingHorizontal: 16, paddingTop: 4 },
  alert: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, padding: 12, borderWidth: 1, borderRadius: 12, backgroundColor: c.surfaceSecondary },
  alertTitle: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 14 },
  alertHint: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
  hero: { borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  heroLabel: { color: c.onBrandSecondary, fontFamily: fonts.displayMedium, fontSize: 11, letterSpacing: 1.2, opacity: 0.9 },
  heroValue: { color: c.onBrandSecondary, fontFamily: fonts.display, fontSize: 44, lineHeight: 48 },
  heroPill: { backgroundColor: "rgba(0,0,0,0.25)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  heroPillText: { color: c.onBrandSecondary, fontFamily: fonts.text, fontSize: 11 },
  row2: { flexDirection: "row", gap: 12, paddingHorizontal: 16 },
  cardLabel: { color: c.muted, fontFamily: fonts.displayMedium, fontSize: 11, letterSpacing: 1 },
  cardValue: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38 },
  cardSub: { color: c.muted, fontFamily: fonts.text, fontSize: 11 },
  link: { color: c.brandPrimary, fontFamily: fonts.displayMedium, fontSize: 13 },
  mapCard: { marginHorizontal: 16, borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.surfaceSecondary, padding: 6, overflow: "hidden" },
  topoCard: { width: 150, padding: 12, gap: 4, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary },
  topoName: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 14 },
  quick: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary },
  quickText: { color: c.onSurfaceSecondary, fontFamily: fonts.displayMedium, fontSize: 13 },
  qNum: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 14 },
  qTotal: { color: c.onSurface, fontFamily: fonts.display, fontSize: 15 },
}));
