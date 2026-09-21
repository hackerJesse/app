import React from "react";
import { FlatList, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/api";
import { Badge, Button, Card, Empty, Header, IconButton, Row, Screen, confirmAsync, notify } from "@/src/components/ui";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { fmtBRL, fmtDate } from "@/src/types";
import { tr } from "@/src/i18n";

type Sub = {
  user_id: string;
  email: string;
  name: string;
  cpf?: string;
  phone?: string;
  address?: string;
  plan?: string;
  has_access: boolean;
  blocked: boolean;
  paid_at?: string;
  created_at?: string;
  contract_accepted_at?: string;
  contract_ip?: string;
  total_paid: number;
  transactions: { session_id: string; plan: string; amount: number; status: string; created_at: string }[];
};

export default function SubscribersScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const subs = useQuery<Sub[]>({ queryKey: ["subscribers"], queryFn: () => api("/admin/subscribers") });
  const setAccess = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) => api(`/admin/subscribers/${id}/access`, { method: "POST", body: { blocked } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscribers"] }),
  });
  const grant = useMutation({
    mutationFn: ({ id, plan, days }: { id: string; plan: string; days: number }) => api(`/admin/subscribers/${id}/grant`, { method: "POST", body: { plan, days } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscribers"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/subscribers/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscribers"] }),
    onError: (e: any) => notify(tr("Erro ao excluir"), e?.message),
  });
  const confirmRemove = async (s: Sub) => {
    if (await confirmAsync(tr("Excluir assinante"), `Excluir ${s.name || s.email}? A conta, o operador vinculado e as sessões serão removidos. Esta ação não pode ser desfeita.`)) remove.mutate(s.user_id);
  };
  const list = subs.data ?? [];
  const paid = list.filter((s) => s.has_access).length;
  const revenue = list.reduce((a, s) => a + s.total_paid, 0);

  return (
    <Screen>
      <Header title={tr("Assinantes")} subtitle={`${list.length} contas · ${paid} ativas · ${list.length - paid} sem acesso`} back />
      <Row gap={8} style={{ padding: 16 }}>
        <Card style={{ flex: 1 }}>
          <Text style={styles.label}>{tr("RECEITA")}</Text>
          <Text style={[styles.value, { color: colors.success }]}>{fmtBRL(revenue)}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={styles.label}>{tr("MENSAIS")}</Text>
          <Text style={styles.value}>{list.filter((s) => s.plan === "monthly").length}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={styles.label}>{tr("VITALÍCIAS")}</Text>
          <Text style={styles.value}>{list.filter((s) => s.plan === "lifetime").length}</Text>
        </Card>
      </Row>
      <FlatList
        data={list}
        keyExtractor={(s) => s.user_id}
        onRefresh={subs.refetch}
        refreshing={subs.isFetching && !subs.isLoading}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 32, flexGrow: 1 }}
        ListEmptyComponent={subs.isLoading ? null : <Empty icon="people-outline" title={tr("Nenhum assinante")} hint={tr("As contas criadas pelo app aparecerão aqui com o status de pagamento.")} />}
        renderItem={({ item: s }) => (
          <Card style={{ gap: 6 }} testID={`sub-${s.user_id}`}>
            <Row>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{s.name || s.email}</Text>
                <Text style={styles.meta}>{s.email}{s.cpf ? ` · CPF ${s.cpf}` : ""}{s.phone ? ` · ${s.phone}` : ""}</Text>
              </View>
              <Badge text={s.blocked ? "bloqueado" : s.has_access ? tr("ativo") : tr("sem pagamento")} tone={s.blocked ? "error" : s.has_access ? "success" : "warning"} />
            </Row>
            <Text style={styles.meta}>
              Plano: {s.plan === "monthly" ? "Mensal R$ 25,90" : s.plan === "lifetime" ? "Vitalício R$ 999" : "—"} · Pago: {fmtBRL(s.total_paid)} · Último pagamento: {s.paid_at ? fmtDate(s.paid_at) : "—"}
            </Text>
            <Text style={styles.meta}>
              Cadastro: {fmtDate(s.created_at)} · Contrato: {s.contract_accepted_at ? `${fmtDate(s.contract_accepted_at)} (IP ${s.contract_ip || "?"})` : "não aceito"}
            </Text>
            {s.address ? <Text style={styles.meta}>{s.address}</Text> : null}
            <Row gap={8}>
              <Text style={[styles.meta, { flex: 1 }]}>{s.transactions.length} transação(ões) · {s.transactions.filter((t) => t.status === "paid").length} paga(s)</Text>
              {!s.has_access || s.blocked ? <Button small title={tr("Aprovar 30 dias")} variant="secondary" icon="checkmark-circle-outline" onPress={() => grant.mutate({ id: s.user_id, plan: "monthly", days: 30 })} testID={`grant-${s.user_id}`} /> : null}
              <Button small title={s.blocked ? tr("Desbloquear") : tr("Bloquear")} variant={s.blocked ? "secondary" : "danger"} onPress={() => setAccess.mutate({ id: s.user_id, blocked: !s.blocked })} testID={`toggle-${s.user_id}`} />
              <IconButton name="trash-outline" color={colors.error} onPress={() => confirmRemove(s)} testID={`delete-${s.user_id}`} />
            </Row>
          </Card>
        )}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  label: { color: c.muted, fontFamily: fonts.displayMedium, fontSize: 10, letterSpacing: 1 },
  value: { color: c.onSurface, fontFamily: fonts.display, fontSize: 20 },
  name: { color: c.onSurface, fontFamily: fonts.displayMedium, fontSize: 15 },
  meta: { color: c.muted, fontFamily: fonts.text, fontSize: 11 },
}));
