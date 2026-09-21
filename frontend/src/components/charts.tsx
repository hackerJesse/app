import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { fonts, makeStyles, useTheme } from "@/src/theme";

export type BarDatum = { label: string; values: { value: number; color: string }[] };

export function StackedBars({ data, height = 120 }: { data: BarDatum[]; height?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const max = Math.max(1, ...data.map((d) => d.values.reduce((s, v) => s + v.value, 0)));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height, gap: 8 }}>
        {data.map((d, i) => {
          const total = d.values.reduce((s, v) => s + v.value, 0);
          return (
            <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height }}>
              <Text style={styles.barValue}>{total || ""}</Text>
              <View style={{ width: "70%", justifyContent: "flex-end" }}>
                {d.values.map((v, j) => (
                  <View
                    key={j}
                    style={{
                      height: Math.max(v.value ? 3 : 0, ((height - 18) * v.value) / max),
                      backgroundColor: v.color,
                      borderTopLeftRadius: j === d.values.length - 1 || d.values.slice(j + 1).every((x) => !x.value) ? 4 : 0,
                      borderTopRightRadius: j === d.values.length - 1 || d.values.slice(j + 1).every((x) => !x.value) ? 4 : 0,
                    }}
                  />
                ))}
                {!total ? <View style={{ height: 3, backgroundColor: colors.surfaceTertiary, borderRadius: 2 }} /> : null}
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {data.map((d, i) => (
          <Text key={i} style={styles.barLabel}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function Donut({ segments, size = 110, label, sub }: { segments: { value: number; color: string }[]; size?: number; label: string; sub?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceTertiary} strokeWidth={10} fill="none" />
        {total > 0
          ? segments.map((s, i) => {
              const len = (s.value / total) * c;
              const el = (
                <Circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={s.color}
                  strokeWidth={10}
                  fill="none"
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              );
              offset += len;
              return el;
            })
          : null}
      </Svg>
      <Text style={styles.donutLabel}>{label}</Text>
      {sub ? <Text style={styles.donutSub}>{sub}</Text> : null}
    </View>
  );
}

export function AreaChart({ values, height = 90, color }: { values: number[]; height?: number; color?: string }) {
  const { colors } = useTheme();
  const stroke = color ?? colors.brandPrimary;
  const w = 300;
  const n = Math.max(values.length, 2);
  const max = Math.max(1, ...values);
  const pts = (values.length ? values : [0, 0]).map((v, i) => [(i / (n - 1)) * w, height - 6 - (v / max) * (height - 16)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
  const area = `${line} L${w} ${height} L0 ${height} Z`;
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stroke} stopOpacity={0.45} />
          <Stop offset="1" stopColor={stroke} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width={w} height={height} fill="transparent" />
      <Path d={area} fill="url(#ag)" />
      <Path d={line} stroke={stroke} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <Circle key={i} cx={p[0]} cy={p[1]} r={3} fill={stroke} />
      ))}
    </Svg>
  );
}

export function LegendDot({ color, label }: { color: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={styles.legend}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  barValue: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 11, height: 16 },
  barLabel: { flex: 1, textAlign: "center", color: c.muted, fontFamily: fonts.text, fontSize: 10 },
  donutLabel: { color: c.onSurface, fontFamily: fonts.display, fontSize: 24, lineHeight: 26 },
  donutSub: { color: c.muted, fontFamily: fonts.text, fontSize: 10 },
  legend: { color: c.muted, fontFamily: fonts.text, fontSize: 11 },
}));
