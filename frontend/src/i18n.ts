import { useSyncExternalStore } from "react";

import { PHRASES } from "@/src/phrases";
import { storage } from "@/src/utils/storage";

export type Lang = "pt" | "en" | "es";
export const LANGS: { value: Lang; label: string }[] = [
  { value: "pt", label: "Português (BR)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

const pt = {
  // menu / navigation
  home: "Início",
  devices: "Dispositivos",
  scanQr: "Ler QR Code",
  quotes: "Orçamentos",
  clients: "Clientes",
  infra: "Infraestrutura",
  servers: "Servidores",
  settings: "Configurações",
  subscribers: "Assinantes",
  logout: "Sair",
  logoutConfirm: "Deseja encerrar a sessão?",
  hint_home: "Dashboard e indicadores",
  hint_devices: "Inventário, etiquetas QR e manutenções",
  hint_scan: "Abrir ficha do dispositivo",
  hint_quotes: "Vendas e serviços, PDF",
  hint_clients: "Cadastro de clientes",
  hint_infra: "Racks, topologias e plantas",
  hint_servers: "Mapa e monitoramento",
  hint_settings: "Tema, logo da empresa, idioma, conta",
  reports: "Relatórios",
  hint_reports: "Ativos, manutenções e servidores em PDF",
  hint_subscribers: "Clientes do app, pagamentos e bloqueios",
  admin: "Administrador",
  user: "Usuário",
  // login
  restricted: "ZATRIZ · ACESSO RESTRITO",
  email: "E-mail",
  password: "Senha",
  signIn: "Entrar",
  signInGoogle: "Entrar com Google",
  signInBiometric: "Entrar com biometria",
  createAccount: "Criar conta (assinatura)",
  forgotPassword: "Esqueci minha senha",
  fillEmailPassword: "Informe e-mail e senha.",
  or: "OU",
  // dashboard
  hello: "Olá",
  registeredDevices: "DISPOSITIVOS CADASTRADOS",
  overduePreventive: "preventiva(s) vencida(s)",
  upcoming: "próxima(s)",
  unstable: "com instabilidade",
  pending: "pendentes",
  approved: "aprovados",
  maintenance6m: "MANUTENÇÕES · ÚLTIMOS 6 MESES",
  preventive: "Preventiva",
  corrective: "Corretiva",
  byType: "POR TIPO",
  latency: "LATÊNCIA (ms)",
  serverMap: "Mapa de servidores",
  openMap: "Abrir mapa",
  topologies: "Topologias de rede",
  seeInfra: "Ver infra",
  quickActions: "Ações rápidas",
  recentQuotes: "Orçamentos recentes",
  // settings
  appearance: "Aparência",
  dark: "Escuro",
  light: "Claro",
  system: "Sistema",
  language: "Idioma",
  companyLogo: "Empresa e logo",
  companyName: "Nome da empresa",
  latencyWarn: "Latência para alerta de instabilidade (ms)",
  saveSettings: "Salvar configurações",
  account: "Conta",
  security: "Segurança",
  biometricLogin: "Login com biometria (digital / rosto)",
  biometricHint: "Ao sair, o app guarda uma credencial protegida para você entrar com a biometria do aparelho.",
  biometricUnavailable: "Biometria não disponível neste dispositivo.",
  // common
  save: "Salvar",
  saved: "Salvo",
  print: "Imprimir",
  cancel: "Cancelar",
  confirm: "Confirmar",
  remove: "Remover",
  search: "Buscar",
  back: "Voltar",
  monitored: "monitorados",
  online: "online",
  unstableShort: "instáveis",
  records: "registros",
  registered: "cadastrados",
  verify: "Verificar",
};

export type TKey = keyof typeof pt;

const en: Record<TKey, string> = {
  home: "Home",
  devices: "Devices",
  scanQr: "Scan QR Code",
  quotes: "Quotes",
  clients: "Clients",
  infra: "Infrastructure",
  servers: "Servers",
  settings: "Settings",
  subscribers: "Subscribers",
  logout: "Sign out",
  logoutConfirm: "Do you want to end the session?",
  hint_home: "Dashboard and indicators",
  hint_devices: "Inventory, QR labels and maintenance",
  hint_scan: "Open the device record",
  hint_quotes: "Sales and services, PDF",
  hint_clients: "Client records",
  hint_infra: "Racks, topologies and floor plans",
  hint_servers: "Map and monitoring",
  hint_settings: "Theme, company logo, language, account",
  reports: "Reports",
  hint_reports: "Assets, maintenance and servers as PDF",
  hint_subscribers: "App customers, payments and blocks",
  admin: "Administrator",
  user: "User",
  restricted: "ZATRIZ · RESTRICTED ACCESS",
  email: "E-mail",
  password: "Password",
  signIn: "Sign in",
  signInGoogle: "Sign in with Google",
  signInBiometric: "Sign in with biometrics",
  createAccount: "Create account (subscription)",
  forgotPassword: "Forgot my password",
  fillEmailPassword: "Enter e-mail and password.",
  or: "OR",
  hello: "Hello",
  registeredDevices: "REGISTERED DEVICES",
  overduePreventive: "overdue preventive(s)",
  upcoming: "upcoming",
  unstable: "unstable",
  pending: "pending",
  approved: "approved",
  maintenance6m: "MAINTENANCE · LAST 6 MONTHS",
  preventive: "Preventive",
  corrective: "Corrective",
  byType: "BY TYPE",
  latency: "LATENCY (ms)",
  serverMap: "Server map",
  openMap: "Open map",
  topologies: "Network topologies",
  seeInfra: "See infra",
  quickActions: "Quick actions",
  recentQuotes: "Recent quotes",
  appearance: "Appearance",
  dark: "Dark",
  light: "Light",
  system: "System",
  language: "Language",
  companyLogo: "Company and logo",
  companyName: "Company name",
  latencyWarn: "Latency threshold for instability alert (ms)",
  saveSettings: "Save settings",
  account: "Account",
  security: "Security",
  biometricLogin: "Biometric login (fingerprint / face)",
  biometricHint: "When you sign out, the app keeps a protected credential so you can sign in with your device biometrics.",
  biometricUnavailable: "Biometrics not available on this device.",
  save: "Save",
  saved: "Saved",
  print: "Print",
  cancel: "Cancel",
  confirm: "Confirm",
  remove: "Remove",
  search: "Search",
  back: "Back",
  monitored: "monitored",
  online: "online",
  unstableShort: "unstable",
  records: "records",
  registered: "registered",
  verify: "Check",
};

const es: Record<TKey, string> = {
  home: "Inicio",
  devices: "Dispositivos",
  scanQr: "Leer código QR",
  quotes: "Presupuestos",
  clients: "Clientes",
  infra: "Infraestructura",
  servers: "Servidores",
  settings: "Configuración",
  subscribers: "Suscriptores",
  logout: "Salir",
  logoutConfirm: "¿Desea cerrar la sesión?",
  hint_home: "Panel e indicadores",
  hint_devices: "Inventario, etiquetas QR y mantenimientos",
  hint_scan: "Abrir la ficha del dispositivo",
  hint_quotes: "Ventas y servicios, PDF",
  hint_clients: "Registro de clientes",
  hint_infra: "Racks, topologías y planos",
  hint_servers: "Mapa y monitoreo",
  hint_settings: "Tema, logo de la empresa, idioma, cuenta",
  reports: "Informes",
  hint_reports: "Activos, mantenimientos y servidores en PDF",
  hint_subscribers: "Clientes de la app, pagos y bloqueos",
  admin: "Administrador",
  user: "Usuario",
  restricted: "ZATRIZ · ACCESO RESTRINGIDO",
  email: "Correo",
  password: "Contraseña",
  signIn: "Entrar",
  signInGoogle: "Entrar con Google",
  signInBiometric: "Entrar con biometría",
  createAccount: "Crear cuenta (suscripción)",
  forgotPassword: "Olvidé mi contraseña",
  fillEmailPassword: "Ingrese correo y contraseña.",
  or: "O",
  hello: "Hola",
  registeredDevices: "DISPOSITIVOS REGISTRADOS",
  overduePreventive: "preventiva(s) vencida(s)",
  upcoming: "próxima(s)",
  unstable: "con inestabilidad",
  pending: "pendientes",
  approved: "aprobados",
  maintenance6m: "MANTENIMIENTOS · ÚLTIMOS 6 MESES",
  preventive: "Preventivo",
  corrective: "Correctivo",
  byType: "POR TIPO",
  latency: "LATENCIA (ms)",
  serverMap: "Mapa de servidores",
  openMap: "Abrir mapa",
  topologies: "Topologías de red",
  seeInfra: "Ver infra",
  quickActions: "Acciones rápidas",
  recentQuotes: "Presupuestos recientes",
  appearance: "Apariencia",
  dark: "Oscuro",
  light: "Claro",
  system: "Sistema",
  language: "Idioma",
  companyLogo: "Empresa y logo",
  companyName: "Nombre de la empresa",
  latencyWarn: "Latencia para alerta de inestabilidad (ms)",
  saveSettings: "Guardar configuración",
  account: "Cuenta",
  security: "Seguridad",
  biometricLogin: "Inicio con biometría (huella / rostro)",
  biometricHint: "Al salir, la app guarda una credencial protegida para entrar con la biometría del dispositivo.",
  biometricUnavailable: "Biometría no disponible en este dispositivo.",
  save: "Guardar",
  saved: "Guardado",
  print: "Imprimir",
  cancel: "Cancelar",
  confirm: "Confirmar",
  remove: "Eliminar",
  search: "Buscar",
  back: "Volver",
  monitored: "monitoreados",
  online: "en línea",
  unstableShort: "inestables",
  records: "registros",
  registered: "registrados",
  verify: "Verificar",
};

const DICT: Record<Lang, Record<TKey, string>> = { pt, en, es };
const KEY = "ns_lang";
let current: Lang = "pt";
const listeners = new Set<() => void>();

export function getLanguage() {
  return current;
}
export function setLanguage(l: Lang) {
  current = l;
  storage.setItem(KEY, l);
  listeners.forEach((fn) => fn());
}
export async function loadLanguage() {
  const saved = await storage.getItem<Lang>(KEY, "pt");
  if (saved === "pt" || saved === "en" || saved === "es") {
    current = saved;
    listeners.forEach((fn) => fn());
  }
}
export function useLanguage(): Lang {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => current,
  );
}
// Tradução de frases das telas internas: chave = texto em português (fallback = a própria frase).
const PHRASE_MAP: Record<"en" | "es", Record<string, string>> = { en: {}, es: {} };
PHRASES.forEach(([pt, en, es]) => {
  PHRASE_MAP.en[pt] = en;
  PHRASE_MAP.es[pt] = es;
});
export function tr(phrase: string): string {
  if (current === "pt") return phrase;
  return PHRASE_MAP[current][phrase] ?? phrase;
}

export function useT() {
  const lang = useLanguage();
  return (key: TKey) => DICT[lang][key] ?? pt[key] ?? key;
}
