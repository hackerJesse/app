import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/api";
import { queryClient } from "@/src/query-client";

export type Settings = {
  company_name?: string;
  logo_path?: string;
  logo_data_url?: string;
  login_image_path?: string;
  tutorial_pdf_url?: string;
  tutorial_video_url?: string;
  latency_warn_ms: number;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_from?: string;
  alert_email?: string;
  alerts_enabled?: boolean;
};

export function useSettings() {
  return useQuery<Settings>({ queryKey: ["settings"], queryFn: () => api<Settings>("/settings"), staleTime: 5 * 60 * 1000 });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Settings>) => api<Settings>("/settings", { method: "PUT", body }),
    onSuccess: (data) => qc.setQueryData(["settings"], data),
  });
}

// Logo (data URL) for PDF/HTML documents, read from the query cache.
export function currentLogo(): string {
  return queryClient.getQueryData<Settings>(["settings"])?.logo_data_url ?? "";
}

export function currentCompany(): string {
  return queryClient.getQueryData<Settings>(["settings"])?.company_name || "N-Security InfraManager";
}

export function docHeaderHtml() {
  const logo = currentLogo();
  const name = currentCompany();
  return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">${
    logo ? `<img src="${logo}" style="height:44px;max-width:180px;object-fit:contain"/>` : ""
  }<div style="font-size:16px;font-weight:bold">${name}</div></div>`;
}
