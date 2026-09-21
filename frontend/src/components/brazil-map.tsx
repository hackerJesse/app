import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Path, Text as SvgText } from "react-native-svg";

import { BR_CITIES, BR_PATH, BR_VIEW_H, BR_VIEW_W, geoToPercent } from "@/src/brazil";
import { BR_STATES } from "@/src/brazil-states";
import { IconButton } from "@/src/components/ui";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import type { Server } from "@/src/types";

const MIN_S = 1;
const MAX_S = 8;

export function serverUnstable(s: Server, warnMs: number) {
  if (s.status === "offline") return true;
  if (s.latency_ms != null && s.latency_ms > warnMs) return true;
  const m = s.metrics;
  if (m && ((m.cpu ?? 0) > 90 || (m.mem ?? 0) > 90 || (m.disk ?? 0) > 90)) return true;
  return false;
}

export function BrazilMap({
  servers,
  onPinPress,
  onMapPress,
  selectedId,
  zoomable = false,
  warnMs = 300,
}: {
  servers: Server[];
  onPinPress?: (s: Server) => void;
  onMapPress?: (xPct: number, yPct: number) => void;
  selectedId?: string;
  zoomable?: boolean;
  warnMs?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sScale = useSharedValue(1);
  const sTx = useSharedValue(0);
  const sTy = useSharedValue(0);

  const regionColor: Record<string, string> = {
    "3": colors.mapNorte,
    "4": colors.mapNordeste,
    "5": colors.mapCentro,
    "2": colors.mapSudeste,
    "1": colors.mapSul,
  };

  const clampPan = (s: number, x: number, y: number) => {
    "worklet";
    const minX = box.w - box.w * s;
    const minY = box.h - box.h * s;
    return { x: Math.min(0, Math.max(minX, x)), y: Math.min(0, Math.max(minY, y)) };
  };

  const applyZoom = (factor: number, cx: number, cy: number) => {
    "worklet";
    const s = Math.min(Math.max(sScale.value * factor, MIN_S), MAX_S);
    const nx = cx - ((cx - sTx.value) / sScale.value) * s;
    const ny = cy - ((cy - sTy.value) / sScale.value) * s;
    const c = clampPan(s, nx, ny);
    scale.value = s;
    tx.value = c.x;
    ty.value = c.y;
  };

  const commit = () => {
    "worklet";
    sScale.value = scale.value;
    sTx.value = tx.value;
    sTy.value = ty.value;
  };

  const pinch = Gesture.Pinch()
    .enabled(zoomable)
    .onUpdate((e) => applyZoom(e.scale, box.w / 2, box.h / 2))
    .onEnd(commit);
  const pan = Gesture.Pan()
    .enabled(zoomable)
    .minDistance(6)
    .onUpdate((e) => {
      const c = clampPan(sScale.value, sTx.value + e.translationX, sTy.value + e.translationY);
      tx.value = c.x;
      ty.value = c.y;
    })
    .onEnd(commit);

  const zoomBy = (f: number) => {
    applyZoom(f, box.w / 2, box.h / 2);
    commit();
  };
  const reset = () => {
    scale.value = withTiming(1);
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    sScale.value = 1;
    sTx.value = 0;
    sTy.value = 0;
  };

  const content = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));

  const handlePress = (e: any) => {
    if (!onMapPress || !box.w) return;
    const ne = e.nativeEvent ?? {};
    const lx = ne.locationX ?? ne.offsetX ?? 0;
    const ly = ne.locationY ?? ne.offsetY ?? 0;
    onMapPress(Math.round((lx / box.w) * 1000) / 10, Math.round((ly / box.h) * 1000) / 10);
  };

  return (
    <View style={styles.wrap} testID="brazil-map-wrap">
      <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
        <Animated.View style={{ width: "100%", aspectRatio: BR_VIEW_W / BR_VIEW_H, overflow: "hidden" }}>
          <Animated.View style={[{ width: "100%", height: "100%", transformOrigin: "0 0" } as any, content]}>
            <Pressable testID="brazil-map" onPress={handlePress} disabled={!onMapPress} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} style={{ width: "100%", height: "100%" }}>
              <Svg width="100%" height="100%" viewBox={`0 0 ${BR_VIEW_W} ${BR_VIEW_H}`} preserveAspectRatio="none" pointerEvents="none">
                <Path d={BR_PATH} fill={colors.surfaceTertiary} stroke="none" />
                {BR_STATES.map((s) => (
                  <Path key={s.uf} d={s.d} fill={regionColor[s.region] ?? colors.surfaceTertiary} stroke={colors.surface} strokeWidth={0.25} fillOpacity={0.85} />
                ))}
                {BR_STATES.map((s) => (
                  <SvgText key={`t${s.uf}`} x={s.cx} y={s.cy + 1} fontSize={2.4} fontWeight="bold" fill={colors.onSurface} textAnchor="middle" opacity={0.85}>
                    {s.uf}
                  </SvgText>
                ))}
              </Svg>
              {zoomable
                ? BR_CITIES.map((c) => {
                    const p = geoToPercent(c.lat, c.lon);
                    return <CityDot key={c.name} name={c.name} x={p.x} y={p.y} scale={scale} />;
                  })
                : null}
              {servers.map((s) => (
                <Pin key={s.id} server={s} unstable={serverUnstable(s, warnMs)} selected={s.id === selectedId} scale={scale} onPress={onPinPress ? () => onPinPress(s) : undefined} />
              ))}
            </Pressable>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      {zoomable ? (
        <View style={styles.zoom}>
          <IconButton name="add" onPress={() => zoomBy(1.6)} testID="map-zoom-in" />
          <IconButton name="remove" onPress={() => zoomBy(0.625)} testID="map-zoom-out" />
          <IconButton name="scan-outline" onPress={reset} testID="map-zoom-reset" />
        </View>
      ) : null}
      <View style={styles.legend}>
        {[
          ["Norte", colors.mapNorte],
          ["Nordeste", colors.mapNordeste],
          ["C.-Oeste", colors.mapCentro],
          ["Sudeste", colors.mapSudeste],
          ["Sul", colors.mapSul],
        ].map(([l, c]) => (
          <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c }} />
            <Text style={styles.legendText}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CityDot({ name, x, y, scale }: { name: string; x: number; y: number; scale: { value: number } }) {
  const styles = useStyles();
  const st = useAnimatedStyle(() => ({
    opacity: scale.value > 2.2 ? Math.min(1, (scale.value - 2.2) / 0.8) : 0,
    transform: [{ scale: 1 / scale.value }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.cityDotWrap, { left: `${x}%`, top: `${y}%` }, st]}>
      <View style={styles.cityDot} />
      <Text style={styles.cityName} numberOfLines={1}>
        {name}
      </Text>
    </Animated.View>
  );
}

function Pin({ server, selected, unstable, scale, onPress }: { server: Server; selected: boolean; unstable: boolean; scale: { value: number }; onPress?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const color = server.status === "online" ? (unstable ? colors.warning : colors.success) : server.status === "offline" ? colors.error : colors.muted;
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 1.8 }], opacity: 0.7 * (1 - pulse.value) }));
  const counter = useAnimatedStyle(() => ({ transform: [{ scale: 1 / scale.value }] }));
  return (
    <Animated.View style={[styles.pin, { left: `${server.map_x}%`, top: `${server.map_y}%` }, counter]}>
      <Pressable testID={`pin-${server.id}`} onPress={onPress} disabled={!onPress} hitSlop={10} style={{ alignItems: "center", justifyContent: "center", width: 28, height: 28 }}>
        <Animated.View style={[styles.ring, { backgroundColor: color }, ring]} />
        <View style={[styles.dot, { backgroundColor: color }, selected && { borderColor: colors.onSurface, borderWidth: 2 }]} />
      </Pressable>
      {server.city ? (
        <Text style={styles.city} numberOfLines={1}>
          {server.city}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { width: "100%", backgroundColor: c.surface, borderRadius: 12, overflow: "hidden" },
  zoom: { position: "absolute", right: 4, top: 4, backgroundColor: c.surfaceSecondary, borderRadius: 10, borderWidth: 1, borderColor: c.border },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", paddingVertical: 6 },
  legendText: { color: c.muted, fontFamily: fonts.text, fontSize: 10 },
  pin: { position: "absolute", width: 28, height: 28, marginLeft: -14, marginTop: -14, alignItems: "center" },
  ring: { position: "absolute", top: 7, left: 7, right: 7, bottom: 7, borderRadius: 14 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: c.surface },
  cityDotWrap: { position: "absolute", width: 8, height: 8, marginLeft: -4, marginTop: -4, alignItems: "center" },
  cityDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.onSurface, opacity: 0.8 },
  cityName: { position: "absolute", top: 6, left: -46, width: 100, textAlign: "center", color: c.onSurface, fontFamily: fonts.text, fontSize: 9, opacity: 0.9 },
  city: { position: "absolute", top: 26, left: -31, width: 90, textAlign: "center", color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 10 },
}));
