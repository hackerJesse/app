import React, { useRef, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";

import { api } from "@/src/api";
import { Button, Header, Icon, Input, Row, Screen } from "@/src/components/ui";
import type { Device } from "@/src/devices";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export default function ScanScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lastRef = useRef<string>("");

  const lookup = async (value: string) => {
    if (!value.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const d = await api<Device>(`/devices/find?code=${encodeURIComponent(value.trim())}`);
      router.replace(`/device/${d.id}`);
    } catch (e: any) {
      setError(e?.status === 404 ? `Nenhum dispositivo encontrado para "${value.trim()}"` : e?.message ?? "Erro na busca");
      setTimeout(() => (lastRef.current = ""), 2500);
    } finally {
      setBusy(false);
    }
  };

  const onScanned = ({ data }: { data: string }) => {
    if (!data || data === lastRef.current) return;
    lastRef.current = data;
    lookup(data);
  };

  const askPermission = async () => {
    const res = await requestPermission();
    if (!res.granted && !res.canAskAgain) Linking.openSettings();
  };

  const renderCamera = () => {
    if (!permission) return null;
    if (permission.granted) {
      return (
        <View style={styles.cameraBox}>
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={busy ? undefined : onScanned} />
          <View style={styles.frame} pointerEvents="none" />
        </View>
      );
    }
    return (
      <View style={styles.permBox}>
        <Icon name="camera-outline" size={40} color={colors.brandPrimary} />
        <Text style={styles.permTitle}>Leitura de QR Code</Text>
        <Text style={styles.permText}>Usamos a câmera apenas para ler a etiqueta do dispositivo e abrir a ficha com o histórico de manutenções.</Text>
        {permission.canAskAgain || Platform.OS === "web" ? (
          <Button title="Permitir câmera" icon="camera-outline" onPress={askPermission} testID="allow-camera" />
        ) : (
          <Button title="Abrir configurações" icon="settings-outline" variant="secondary" onPress={() => Linking.openSettings()} testID="open-settings" />
        )}
      </View>
    );
  };

  return (
    <Screen>
      <Header title="Ler QR Code" subtitle="Aponte para a etiqueta do dispositivo" back />
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        {renderCamera()}
        <Text style={styles.or}>OU DIGITE O CÓDIGO</Text>
        <Row gap={8}>
          <Input style={{ flex: 1 }} value={code} onChangeText={setCode} placeholder="Patrimônio ou nº de série" autoCapitalize="characters" onSubmitEditing={() => lookup(code)} testID="scan-code" />
          <Button title="Buscar" icon="search-outline" onPress={() => lookup(code)} loading={busy} testID="scan-search" />
        </Row>
        {error ? (
          <Text style={styles.error} testID="scan-error">
            {error}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  cameraBox: { flex: 1, borderRadius: 4, overflow: "hidden", borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, minHeight: 260 },
  frame: { position: "absolute", top: "18%", left: "15%", right: "15%", bottom: "18%", borderWidth: 2, borderColor: c.brandPrimary, borderRadius: 8 },
  permBox: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, borderWidth: 1, borderColor: c.border, borderRadius: 4, backgroundColor: c.surfaceSecondary },
  permTitle: { color: c.onSurface, fontFamily: fonts.display, fontSize: 20 },
  permText: { color: c.muted, fontFamily: fonts.text, fontSize: 13, textAlign: "center" },
  or: { color: c.muted, fontFamily: fonts.displayMedium, fontSize: 12, letterSpacing: 1.5, textAlign: "center" },
  error: { color: c.error, fontFamily: fonts.text, fontSize: 13 },
}));
