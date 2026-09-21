import React, { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Defs, Line, Path, Pattern, Rect } from "react-native-svg";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, useTheme } from "@/src/theme";
import { CANVAS_H, CANVAS_W, NODE_KIND_MAP, NODE_SIZE } from "@/src/topology";
import type { TopoLink, TopoNode } from "@/src/types";

const MIN_SCALE = 0.25;
const MAX_SCALE = 3;

type Props = {
  nodes: TopoNode[];
  links: TopoLink[];
  selectedId?: string | null;
  connectFrom?: string | null;
  onNodeTap: (id: string) => void;
  onNodeMove: (id: string, x: number, y: number) => void;
  onLinkTap: (id: string) => void;
};

export type CanvasHandle = { zoomBy: (f: number) => void; fit: () => void };

export function TopologyCanvas({ nodes, links, selectedId, connectFrom, onNodeTap, onNodeMove, onLinkTap, handleRef }: Props & { handleRef: React.MutableRefObject<CanvasHandle | null> }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [view, setView] = useState({ w: 0, h: 0 });

  const scale = useSharedValue(0.6);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedScale = useSharedValue(0.6);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const fit = useCallback(() => {
    if (!view.w || !view.h) return;
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = nodes.length ? Math.min(...xs) - 100 : 0;
    const minY = nodes.length ? Math.min(...ys) - 100 : 0;
    const maxX = nodes.length ? Math.max(...xs) + 100 : CANVAS_W;
    const maxY = nodes.length ? Math.max(...ys) + 100 : CANVAS_H;
    const s = Math.min(Math.max(Math.min(view.w / (maxX - minX), view.h / (maxY - minY)), MIN_SCALE), 1.2);
    scale.value = s;
    savedScale.value = s;
    tx.value = (view.w - (maxX + minX) * s) / 2;
    ty.value = (view.h - (maxY + minY) * s) / 2;
    savedTx.value = tx.value;
    savedTy.value = ty.value;
  }, [view, nodes, scale, savedScale, tx, ty, savedTx, savedTy]);

  const zoomBy = useCallback(
    (f: number) => {
      const s = Math.min(Math.max(scale.value * f, MIN_SCALE), MAX_SCALE);
      const cx = view.w / 2;
      const cy = view.h / 2;
      tx.value = cx - ((cx - tx.value) / scale.value) * s;
      ty.value = cy - ((cy - ty.value) / scale.value) * s;
      scale.value = s;
      savedScale.value = s;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    },
    [view, scale, tx, ty, savedScale, savedTx, savedTy],
  );

  useEffect(() => {
    handleRef.current = { zoomBy, fit };
  }, [handleRef, zoomBy, fit]);

  // Fit once when the view gets its size, and again when nodes first arrive.
  const [fitted, setFitted] = useState(false);
  const prevCount = React.useRef(nodes.length);
  useEffect(() => {
    if (view.w && !fitted) {
      fit();
      setFitted(true);
    }
  }, [view, fitted, fit]);
  useEffect(() => {
    if (prevCount.current === 0 && nodes.length > 0 && view.w) fit();
    prevCount.current = nodes.length;
  }, [nodes.length, view.w, fit]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const s = Math.min(Math.max(savedScale.value * e.scale, MIN_SCALE), MAX_SCALE);
      const cx = view.w / 2;
      const cy = view.h / 2;
      tx.value = cx - ((cx - savedTx.value) / savedScale.value) * s;
      ty.value = cy - ((cy - savedTy.value) / savedScale.value) * s;
      scale.value = s;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const pan = Gesture.Pan()
    .minDistance(8)
    .onUpdate((e) => {
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <View style={styles.viewport} onLayout={(e) => setView({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} testID="topology-canvas">
      <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
        <Animated.View style={{ flex: 1 }}>
          <Animated.View style={[styles.canvas, canvasStyle]}>
            <Svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", top: 0, left: 0 }} pointerEvents="none">
              <Defs>
                <Pattern id="grid" width={50} height={50} patternUnits="userSpaceOnUse">
                  <Path d="M50 0 L0 0 0 50" fill="none" stroke={colors.canvasGrid} strokeWidth={1} />
                </Pattern>
              </Defs>
              <Rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" />
              {links.map((l) => {
                const a = byId.get(l.source);
                const b = byId.get(l.target);
                if (!a || !b) return null;
                return <Line key={l.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={colors.borderStrong} strokeWidth={3} />;
              })}
            </Svg>
            {links.map((l) => {
              const a = byId.get(l.source);
              const b = byId.get(l.target);
              if (!a || !b) return null;
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              return (
                <Pressable key={l.id} testID={`link-${l.id}`} onPress={() => onLinkTap(l.id)} style={[styles.linkBtn, { left: mx - 22, top: my - 14 }]}>
                  <Text style={styles.linkText} numberOfLines={1}>
                    {l.label || "—"}
                  </Text>
                </Pressable>
              );
            })}
            {nodes.map((n) => (
              <NodeView key={n.id} node={n} scale={scale} selected={n.id === selectedId} connectSource={n.id === connectFrom} connecting={!!connectFrom} onTap={onNodeTap} onMove={onNodeMove} />
            ))}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function NodeView({
  node,
  scale,
  selected,
  connectSource,
  connecting,
  onTap,
  onMove,
}: {
  node: TopoNode;
  scale: { value: number };
  selected: boolean;
  connectSource: boolean;
  connecting: boolean;
  onTap: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const meta = NODE_KIND_MAP[node.kind] ?? NODE_KIND_MAP.pc;
  const x = useSharedValue(node.x);
  const y = useSharedValue(node.y);
  const sx = useSharedValue(node.x);
  const sy = useSharedValue(node.y);

  useEffect(() => {
    x.value = node.x;
    y.value = node.y;
  }, [node.x, node.y, x, y]);

  const pan = Gesture.Pan()
    .minDistance(6)
    .onStart(() => {
      sx.value = x.value;
      sy.value = y.value;
    })
    .onUpdate((e) => {
      x.value = sx.value + e.translationX / scale.value;
      y.value = sy.value + e.translationY / scale.value;
    })
    .onEnd(() => {
      runOnJS(onMove)(node.id, Math.round(x.value), Math.round(y.value));
    });

  const tap = Gesture.Tap()
    .maxDistance(10)
    .onEnd((_e, success) => {
      if (success) runOnJS(onTap)(node.id);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value - 50 }, { translateY: y.value - NODE_SIZE / 2 }],
  }));

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <Animated.View style={[styles.node, style]} testID={`node-${node.id}`}>
        <View
          style={[
            styles.nodeBox,
            { borderColor: meta.color },
            selected && { borderColor: colors.brandPrimary, borderWidth: 3 },
            connectSource && { backgroundColor: colors.brandTertiary },
            connecting && !connectSource && { borderStyle: "dashed" },
          ]}
        >
          <Ionicons name={meta.icon as any} size={26} color={meta.color} />
        </View>
        <Text style={styles.nodeLabel} numberOfLines={1}>
          {node.label}
        </Text>
        {node.ip ? (
          <Text style={styles.nodeIp} numberOfLines={1}>
            {node.ip}
          </Text>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const useStyles = makeStyles((c) => ({
  viewport: { flex: 1, overflow: "hidden", backgroundColor: c.surface },
  canvas: { position: "absolute", top: 0, left: 0, width: CANVAS_W, height: CANVAS_H, transformOrigin: "0 0" as any },
  node: { position: "absolute", width: 100, alignItems: "center" },
  nodeBox: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: c.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeLabel: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 13, marginTop: 4 },
  nodeIp: { color: c.muted, fontFamily: fonts.text, fontSize: 11 },
  linkBtn: {
    position: "absolute",
    width: 44,
    height: 28,
    borderRadius: 4,
    backgroundColor: c.surfaceTertiary,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  linkText: { color: c.onSurfaceTertiary, fontFamily: fonts.text, fontSize: 10 },
}));
