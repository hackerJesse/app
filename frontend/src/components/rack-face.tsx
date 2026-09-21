import React, { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Circle, Rect, Text as SvgText } from "react-native-svg";

import { fonts, makeStyles, useTheme } from "@/src/theme";

// Realistic-ish front faces for rack equipment (GLPI-like). Units: viewBox 100 x (10 * uSize).
const ACTIVE = new Set(["switch48", "switch24", "switch8", "router", "firewall", "server1", "server2", "server4", "storage", "nvr", "ups", "kvm", "tower"]);

export type LedStatus = "online" | "unstable" | "offline" | null;

export function RackFace({ kind, uSize, label, width, height, status = null }: { kind: string; uSize: number; label: string; width: number; height: number; status?: LedStatus }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const H = 10 * uSize;
  const body = "#1b1d22";
  const metal = "#2c2f36";
  const light = "#3a3e47";
  const portFill = "#0b0c10";
  const portStroke = "#6b7280";

  const ports = (count: number, y: number, rows: number, x0 = 10, x1 = 84) => {
    const perRow = Math.ceil(count / rows);
    const w = (x1 - x0) / perRow;
    const out: React.ReactNode[] = [];
    for (let r = 0; r < rows; r++)
      for (let i = 0; i < perRow; i++) out.push(<Rect key={`${r}-${i}`} x={x0 + i * w + 0.3} y={y + r * 3.2} width={w - 0.6} height={2.6} fill={portFill} stroke={portStroke} strokeWidth={0.25} />);
    return out;
  };
  const bays = (rows: number, cols: number, x0: number, y0: number, w: number, h: number) => {
    const out: React.ReactNode[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        out.push(
          <React.Fragment key={`${r}-${c}`}>
            <Rect x={x0 + c * w} y={y0 + r * h} width={w - 0.6} height={h - 0.6} fill={light} stroke={body} strokeWidth={0.3} rx={0.4} />
            <Rect x={x0 + c * w + 0.8} y={y0 + r * h + h * 0.6} width={w * 0.5} height={0.9} fill={body} />
            <Circle cx={x0 + c * w + w - 2} cy={y0 + r * h + h / 2} r={0.6} fill="#22c55e" />
          </React.Fragment>,
        );
    return out;
  };
  const screws = (
    <>
      {[1.5, H - 1.5].map((y) => (
        <React.Fragment key={y}>
          <Circle cx={2} cy={y} r={0.7} fill="#0f1115" />
          <Circle cx={98} cy={y} r={0.7} fill="#0f1115" />
        </React.Fragment>
      ))}
    </>
  );

  let inner: React.ReactNode = null;
  if (kind.startsWith("switch")) {
    const n = kind === "switch48" ? 48 : kind === "switch24" ? 24 : 8;
    inner = (
      <>
        <Rect x={0} y={0} width={100} height={H} fill={body} />
        {ports(n, H / 2 - (n > 8 ? 3.2 : 1.3), n > 8 ? 2 : 1, 14, 86)}
        <Rect x={88} y={2} width={9} height={H - 4} fill={metal} rx={0.5} />
        <Rect x={89} y={3} width={3} height={2.6} fill={portFill} stroke={portStroke} strokeWidth={0.25} />
        <Rect x={93} y={3} width={3} height={2.6} fill={portFill} stroke={portStroke} strokeWidth={0.25} />
        <SvgText x={4} y={H / 2 + 1.2} fontSize={3} fill="#9ca3af" fontWeight="bold">
          {n}P
        </SvgText>
      </>
    );
  } else if (kind.startsWith("patch")) {
    const n = kind === "patch48" ? 48 : 24;
    inner = (
      <>
        <Rect x={0} y={0} width={100} height={H} fill={metal} />
        {ports(n, H / 2 - (uSize > 1 ? 3.2 : 1.3), uSize > 1 ? 2 : 1, 6, 94)}
      </>
    );
  } else if (kind.startsWith("server") || kind === "storage" || kind === "nvr") {
    const rows = Math.max(1, uSize);
    const cols = kind === "storage" || kind === "nvr" ? 8 : kind === "server1" ? 4 : 6;
    inner = (
      <>
        <Rect x={0} y={0} width={100} height={H} fill={body} />
        <Rect x={4} y={1} width={70} height={H - 2} fill="#14161a" rx={0.6} />
        {bays(rows, cols, 5, 1.6, 68 / cols, (H - 3.2) / rows)}
        <Rect x={78} y={1.5} width={18} height={H - 3} fill={metal} rx={0.8} />
        {Array.from({ length: Math.min(4, uSize * 2) }).map((_, i) => (
          <Rect key={i} x={80 + (i % 2) * 7} y={3 + Math.floor(i / 2) * 4} width={5} height={2.2} fill="#0f1115" />
        ))}
      </>
    );
  } else if (kind === "tower") {
    inner = (
      <>
        <Rect x={0} y={0} width={100} height={H} fill="#0e1014" />
        <Rect x={30} y={1} width={40} height={H - 2} fill="#23262d" rx={1.5} stroke="#3f4451" strokeWidth={0.4} />
        <Rect x={34} y={3} width={32} height={H * 0.18} fill="#14161a" rx={0.6} />
        {Array.from({ length: 3 }).map((_, i) => (
          <Rect key={i} x={35} y={4 + i * (H * 0.05)} width={30} height={H * 0.035} fill="#2c2f36" />
        ))}
        <Rect x={36} y={H * 0.32} width={28} height={H * 0.55} fill="#1b1d22" rx={0.8} />
        {Array.from({ length: Math.max(2, Math.floor(H / 8)) }).map((_, i) => (
          <Rect key={i} x={38} y={H * 0.36 + i * 4} width={24} height={1.2} fill="#0b0c10" />
        ))}
        <Circle cx={64} cy={H * 0.26} r={1.2} fill="#22c55e" />
      </>
    );
  } else if (kind === "ups") {
    inner = (
      <>
        <Rect x={0} y={0} width={100} height={H} fill={body} />
        <Rect x={8} y={H / 2 - 4} width={26} height={8} fill="#0f2f4f" stroke="#38bdf8" strokeWidth={0.4} rx={0.6} />
        <SvgText x={10} y={H / 2 + 1.5} fontSize={3.2} fill="#7dd3fc">
          100% ONLINE
        </SvgText>
        {Array.from({ length: 4 }).map((_, i) => (
          <Rect key={i} x={44 + i * 12} y={H / 2 - 3} width={9} height={6} fill="#0b0c10" stroke={portStroke} strokeWidth={0.3} rx={0.6} />
        ))}
      </>
    );
  } else if (kind === "pdu") {
    inner = (
      <>
        <Rect x={0} y={0} width={100} height={H} fill={metal} />
        {Array.from({ length: 8 }).map((_, i) => (
          <Rect key={i} x={6 + i * 11.5} y={2} width={8} height={H - 4} fill="#0b0c10" stroke={portStroke} strokeWidth={0.3} rx={0.8} />
        ))}
      </>
    );
  } else if (kind === "router" || kind === "firewall") {
    inner = (
      <>
        <Rect x={0} y={0} width={100} height={H} fill={kind === "firewall" ? "#2a1418" : body} />
        {ports(8, H / 2 - 1.3, 1, 40, 84)}
        <Rect x={88} y={2} width={9} height={H - 4} fill={metal} rx={0.5} />
        <SvgText x={5} y={H / 2 + 1.2} fontSize={3} fill="#9ca3af" fontWeight="bold">
          {kind === "firewall" ? "FW" : "RTR"}
        </SvgText>
      </>
    );
  } else if (kind === "cable_guide") {
    inner = (
      <>
        <Rect x={0} y={0} width={100} height={H} fill="#111318" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Rect key={i} x={6 + i * 15.5} y={1.2} width={12} height={H - 2.4} fill="none" stroke="#4b5563" strokeWidth={1} rx={2} />
        ))}
      </>
    );
  } else if (kind === "shelf") {
    inner = (
      <>
        <Rect x={0} y={0} width={100} height={H} fill="#0e1014" />
        <Rect x={3} y={H - 3.5} width={94} height={3} fill="#4b5563" />
        <Rect x={3} y={H - 3.5} width={94} height={0.8} fill="#9ca3af" />
      </>
    );
  } else if (kind === "dio") {
    inner = (
      <>
        <Rect x={0} y={0} width={100} height={H} fill={metal} />
        {Array.from({ length: 12 }).map((_, i) => (
          <Circle key={i} cx={10 + i * 7} cy={H / 2} r={1.6} fill="#0b0c10" stroke="#22d3ee" strokeWidth={0.4} />
        ))}
      </>
    );
  } else if (kind === "kvm") {
    inner = (
      <>
        <Rect x={0} y={0} width={100} height={H} fill={body} />
        <Rect x={6} y={1.5} width={30} height={H - 3} fill="#0f2f4f" rx={0.6} />
        {ports(4, H / 2 - 1.3, 1, 60, 86)}
      </>
    );
  } else if (kind === "blank") {
    inner = <Rect x={0} y={0} width={100} height={H} fill="#15171c" />;
  } else {
    inner = <Rect x={0} y={0} width={100} height={H} fill={body} />;
  }

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 100 ${H}`} preserveAspectRatio="none">
        {inner}
        {screws}
      </Svg>
      {ACTIVE.has(kind) ? <Leds status={status} /> : null}
      <View style={styles.labelWrap} pointerEvents="none">
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.brandPrimary, opacity: 0.9 }} />
    </View>
  );
}

// LED: verde piscando = ativo; amarelo fixo = instável; vermelho piscando = offline.
function Leds({ status }: { status: LedStatus }) {
  const styles = useStyles();
  const blink = useSharedValue(1);
  const blinking = status !== "unstable";
  useEffect(() => {
    if (blinking) blink.value = withRepeat(withSequence(withTiming(0.15, { duration: status === "offline" ? 400 : 120 }), withTiming(1, { duration: status === "offline" ? 400 : 180 }), withTiming(1, { duration: 300 + Math.random() * 600 })), -1, false);
    else blink.value = 1;
  }, [blink, blinking, status]);
  const st = useAnimatedStyle(() => ({ opacity: blink.value }));
  const color = status === "offline" ? "#ef4444" : status === "unstable" ? "#f59e0b" : "#22c55e";
  return (
    <View style={styles.leds} pointerEvents="none">
      <View style={[styles.led, { backgroundColor: "#22c55e", shadowColor: "#22c55e" }]} />
      <Animated.View style={[styles.led, { backgroundColor: color, shadowColor: color }, st]} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  labelWrap: { position: "absolute", left: 8, top: 3, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  label: { color: "#F3F4F6", fontFamily: fonts.displayMedium, fontSize: 11 },
  leds: { position: "absolute", right: 8, top: 4, flexDirection: "row", gap: 4 },
  led: { width: 6, height: 6, borderRadius: 3, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
}));
