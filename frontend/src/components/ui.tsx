import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, useTheme } from "@/src/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? colors.onSurface} />;
}

// ---------------------------------------------------------------- Main menu registry
let menuOpener: (() => void) | null = null;
export function registerMenuOpener(fn: (() => void) | null) {
  menuOpener = fn;
}
export function openMainMenu() {
  menuOpener?.();
}

// ---------------------------------------------------------------- Screen/Header
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return <View style={[styles.screen, { paddingTop: insets.top }, style]}>{children}</View>;
}

export function Header({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const styles = useStyles();
  const router = useRouter();
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable
          testID="back-button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          style={styles.iconBtn}
          hitSlop={8}
        >
          <Icon name="chevron-back" size={22} />
        </Pressable>
      ) : (
        <Pressable testID="menu-button" onPress={openMainMenu} style={styles.iconBtn} hitSlop={8}>
          <Icon name="menu-outline" size={26} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.headerSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function IconButton({
  name,
  onPress,
  color,
  testID,
  size = 22,
}: {
  name: IconName;
  onPress: () => void;
  color?: string;
  testID?: string;
  size?: number;
}) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={styles.iconBtn} hitSlop={6} testID={testID}>
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

// ---------------------------------------------------------------- Button
type Variant = "primary" | "secondary" | "ghost" | "danger";
export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  style,
  testID,
  small,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  small?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const fg = {
    primary: colors.onBrandPrimary,
    secondary: colors.onSurfaceSecondary,
    ghost: colors.brandPrimary,
    danger: colors.error,
  }[variant];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        styles[`btn_${variant}`],
        small && styles.btnSmall,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.btnText, { color: fg }, small && { fontSize: 13 }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------- Input
export function Input({
  label,
  error,
  style,
  ...props
}: Omit<TextInputProps, "style"> & { label?: string; error?: string; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        style={[styles.input, props.multiline && { minHeight: 80, textAlignVertical: "top" }, error && { borderColor: colors.error }]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function Row({ children, gap = 8, style }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", gap, alignItems: "center" }, style]}>{children}</View>;
}

// ---------------------------------------------------------------- Card / Badge
export function Card({ children, style, onPress, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }) {
  const styles = useStyles();
  if (onPress)
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function Badge({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "success" | "warning" | "error" | "brand" }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const map = {
    neutral: [colors.surfaceTertiary, colors.onSurfaceTertiary],
    success: [colors.success, colors.onSuccess],
    warning: [colors.warning, colors.onWarning],
    error: [colors.error, colors.onError],
    brand: [colors.brandTertiary, colors.onBrandTertiary],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map[0] }]}>
      <Text style={[styles.badgeText, { color: map[1] }]}>{text.toUpperCase()}</Text>
    </View>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      {right}
    </View>
  );
}

export function Empty({ icon, title, hint, action }: { icon: IconName; title: string; hint?: string; action?: React.ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={colors.muted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
      {action}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
      <ActivityIndicator color={colors.brandPrimary} size="large" />
    </View>
  );
}

// ---------------------------------------------------------------- Segmented
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const styles = useStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentWrap}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} testID={`segment-${o.value}`} onPress={() => onChange(o.value)} style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------- Sheet (bottom modal)
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={styles.backdrop} onPress={onClose} testID="sheet-backdrop" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <IconButton name="close" onPress={onClose} testID="sheet-close" />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------- Select (sheet picker)
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = "Selecionar",
  testID,
}: {
  label?: string;
  value: T | "" | undefined;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  placeholder?: string;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const current = options.find((o) => o.value === value);
  const searchable = options.length > 20;
  const shown = searchable && filter ? options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase())).slice(0, 80) : searchable ? options.slice(0, 80) : options;
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable testID={testID} onPress={() => setOpen(true)} style={[styles.input, { flexDirection: "row", alignItems: "center" }]}>
        <Text style={{ flex: 1, color: current ? colors.onSurface : colors.muted, fontFamily: fonts.text, fontSize: 14 }}>
          {current?.label ?? placeholder}
        </Text>
        <Icon name="chevron-down" size={16} color={colors.muted} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? "Selecionar"}>
        {searchable ? (
          <TextInput value={filter} onChangeText={setFilter} placeholder="Digite para filtrar..." placeholderTextColor={colors.muted} style={styles.input} autoFocus testID={testID ? `${testID}-filter` : undefined} />
        ) : null}
        {options.length === 0 ? <Text style={{ color: colors.muted }}>Nenhuma opção disponível</Text> : null}
        {shown.map((o) => (
          <Pressable
            key={o.value}
            testID={`option-${o.value}`}
            onPress={() => {
              onChange(o.value);
              setOpen(false);
            }}
            style={[styles.option, o.value === value && styles.optionActive]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.optionText}>{o.label}</Text>
              {o.hint ? <Text style={styles.optionHint}>{o.hint}</Text> : null}
            </View>
            {o.value === value ? <Icon name="checkmark" size={18} color={colors.brandPrimary} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

export function Fab({ onPress, icon = "add", testID }: { onPress: () => void; icon?: IconName; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.fab, { bottom: 16 + insets.bottom }]}>
      <Ionicons name={icon} size={26} color={colors.onBrandPrimary} />
    </Pressable>
  );
}

export function StickyBar({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return <View style={[styles.sticky, { paddingBottom: Math.max(insets.bottom, 12) }]}>{children}</View>;
}

export function confirmAsync(title: string, message: string): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(typeof window !== "undefined" ? window.confirm(`${title}\n\n${message}`) : false);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      { text: "Confirmar", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

export function notify(title: string, message?: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.surface,
  },
  headerTitle: { color: c.onSurface, fontFamily: fonts.display, fontSize: 22, letterSpacing: 0.5 },
  headerSub: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 4 },
  btn: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  btnSmall: { minHeight: 32, paddingHorizontal: 12 },
  btn_primary: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  btn_secondary: { backgroundColor: c.surfaceTertiary, borderColor: c.border },
  btn_ghost: { backgroundColor: "transparent", borderColor: c.brandPrimary },
  btn_danger: { backgroundColor: "transparent", borderColor: c.error },
  btnText: { fontFamily: fonts.displayMedium, fontSize: 14, letterSpacing: 0.4 },
  field: { gap: 6 },
  label: { color: c.muted, fontFamily: fonts.text, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" },
  input: {
    backgroundColor: c.surfaceTertiary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: c.onSurface,
    fontFamily: fonts.text,
    fontSize: 14,
  },
  errorText: { color: c.error, fontSize: 12, fontFamily: fonts.text },
  card: { backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontFamily: fonts.displayMedium, fontSize: 11, letterSpacing: 0.8 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { color: c.muted, fontFamily: fonts.displayMedium, fontSize: 13, letterSpacing: 1.2 },
  empty: { alignItems: "center", justifyContent: "center", padding: 32, gap: 8, flex: 1 },
  emptyTitle: { color: c.onSurface, fontFamily: fonts.display, fontSize: 18 },
  emptyHint: { color: c.muted, fontFamily: fonts.text, fontSize: 13, textAlign: "center" },
  segmentWrap: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  segment: { paddingHorizontal: 14, height: 32, justifyContent: "center", borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary },
  segmentActive: { backgroundColor: c.brandTertiary, borderColor: c.brandPrimary },
  segmentText: { color: c.onSurfaceTertiary, fontFamily: fonts.displayMedium, fontSize: 13, letterSpacing: 0.3 },
  segmentTextActive: { color: c.onBrandTertiary },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.backdrop },
  sheet: { backgroundColor: c.surfaceSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: c.border, maxHeight: "90%" },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, alignSelf: "center", marginTop: 8 },
  sheetHeader: { flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 4, height: 48, borderBottomWidth: 1, borderBottomColor: c.border },
  sheetTitle: { flex: 1, color: c.onSurface, fontFamily: fonts.display, fontSize: 18 },
  sheetFooter: { padding: 16, borderTopWidth: 1, borderTopColor: c.border, gap: 8 },
  option: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary },
  optionActive: { borderColor: c.brandPrimary },
  optionText: { color: c.onSurface, fontFamily: fonts.text, fontSize: 15 },
  optionHint: { color: c.muted, fontFamily: fonts.text, fontSize: 12 },
  fab: {
    position: "absolute",
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  sticky: { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
}));
