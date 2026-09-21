import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
const TOKEN_KEY = "ns_session_token";

let token: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function getToken() {
  return token;
}

export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

export async function loadToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
  } else {
    token = await storage.secureGet<string | null>(TOKEN_KEY, null);
  }
  return token;
}

export async function saveToken(value: string | null) {
  token = value;
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return;
    if (value) window.localStorage.setItem(TOKEN_KEY, value);
    else window.localStorage.removeItem(TOKEN_KEY);
  } else if (value) {
    await storage.secureSet(TOKEN_KEY, value);
  } else {
    await storage.secureRemove(TOKEN_KEY);
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Options = { method?: string; body?: unknown; auth?: boolean };

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth !== false && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 && opts.auth !== false) {
    unauthorizedHandler?.();
  }
  if (!res.ok) {
    let detail = `Erro ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") detail = data.detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function fileUrl(path: string) {
  return `${BASE}/files/${path}?token=${token ?? ""}`;
}

export async function uploadImage(uri: string, fileName: string, mimeType: string): Promise<string> {
  if (Platform.OS !== "web") {
    // Native: expo-file-system multipart upload (fetch+FormData with file URIs is unreliable on Android).
    const FileSystem = await import("expo-file-system/legacy");
    const r = await FileSystem.uploadAsync(`${BASE}/upload`, uri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType,
      parameters: { filename: fileName },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (r.status < 200 || r.status >= 300) throw new ApiError(r.status, `Falha ao enviar imagem (${r.status})`);
    return JSON.parse(r.body).path as string;
  }
  const form = new FormData();
  const blob = await (await fetch(uri)).blob();
  form.append("file", blob, fileName);
  const res = await fetch(`${BASE}/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) throw new ApiError(res.status, "Falha ao enviar imagem");
  const data = await res.json();
  return data.path as string;
}
