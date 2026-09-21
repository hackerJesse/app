import React from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/api";
import { Row, Select } from "@/src/components/ui";

type City = { name: string; lat: number; lon: number };

export function StateCityPicker({
  state,
  city,
  onChange,
  testID = "geo",
}: {
  state?: string;
  city?: string;
  onChange: (v: { state: string; city: string; lat?: number; lon?: number }) => void;
  testID?: string;
}) {
  const states = useQuery<{ uf: string; name: string }[]>({ queryKey: ["geo-states"], queryFn: () => api("/geo/states", { auth: false }), staleTime: Infinity });
  const cities = useQuery<City[]>({ queryKey: ["geo-cities", state], queryFn: () => api(`/geo/cities?uf=${state}`, { auth: false }), enabled: !!state, staleTime: Infinity });
  return (
    <Row gap={8} style={{ alignItems: "flex-start" }}>
      <View style={{ flex: 1 }}>
        <Select label="Estado" value={state ?? ""} options={(states.data ?? []).map((s) => ({ value: s.uf, label: `${s.uf} · ${s.name}` }))} onChange={(uf) => onChange({ state: uf, city: "" })} placeholder="UF" testID={`${testID}-state`} />
      </View>
      <View style={{ flex: 1.6 }}>
        <Select
          label="Cidade"
          value={city ?? ""}
          options={(cities.data ?? []).map((c) => ({ value: c.name, label: c.name }))}
          onChange={(name) => {
            const c = cities.data?.find((x) => x.name === name);
            onChange({ state: state ?? "", city: name, lat: c?.lat, lon: c?.lon });
          }}
          placeholder={state ? (cities.isLoading ? "Carregando..." : "Selecionar cidade") : "Escolha o estado"}
          testID={`${testID}-city`}
        />
      </View>
    </Row>
  );
}
