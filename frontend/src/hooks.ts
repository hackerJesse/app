import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/api";

export type Resource = "clients" | "quotes" | "racks" | "topologies" | "floorplans" | "servers" | "devices";

export function useList<T extends { id: string }>(resource: Resource) {
  return useQuery<T[]>({ queryKey: [resource], queryFn: () => api<T[]>(`/${resource}`) });
}

export function useItem<T extends { id: string }>(resource: Resource, id?: string) {
  const q = useList<T>(resource);
  return { ...q, item: id ? q.data?.find((x) => x.id === id) : undefined };
}

export function useSave<T extends { id: string }>(resource: Resource) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (doc: Partial<T> & { id?: string }) =>
      doc.id ? api<T>(`/${resource}/${doc.id}`, { method: "PUT", body: doc }) : api<T>(`/${resource}`, { method: "POST", body: doc }),
    onSuccess: (saved) => {
      qc.setQueryData<T[]>([resource], (old) => {
        if (!old) return [saved];
        const idx = old.findIndex((x) => x.id === saved.id);
        if (idx === -1) return [...old, saved];
        const copy = [...old];
        copy[idx] = saved;
        return copy;
      });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useRemove(resource: Resource) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/${resource}/${id}`, { method: "DELETE" }),
    onSuccess: (_d, id) => {
      qc.setQueryData<{ id: string }[]>([resource], (old) => old?.filter((x) => x.id !== id) ?? []);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
