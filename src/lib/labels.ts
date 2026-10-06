export const PROSPECT_STATUS: Record<string, { label: string; tone: Tone }> = {
  nuevo: { label: "Nuevo", tone: "slate" },
  a_llamar: { label: "A llamar", tone: "blue" },
  no_contesta: { label: "No contesta", tone: "amber" },
  contactado: { label: "Contactado", tone: "indigo" },
  interesado: { label: "Interesado", tone: "violet" },
  reunion: { label: "Reunión", tone: "violet" },
  propuesta: { label: "Propuesta enviada", tone: "fuchsia" },
  cliente: { label: "Cliente", tone: "emerald" },
  descartado: { label: "Descartado", tone: "rose" },
};

export const LEAD_STATUS: Record<string, { label: string; tone: Tone }> = {
  nuevo: { label: "Nuevo", tone: "blue" },
  en_llamada: { label: "En llamada", tone: "indigo" },
  no_contesta: { label: "No contesta", tone: "amber" },
  volver_a_llamar: { label: "Volver a llamar", tone: "violet" },
  contactado: { label: "Contactado", tone: "indigo" },
  cita_agendada: { label: "Cita agendada", tone: "emerald" },
  no_cualificado: { label: "No cualificado", tone: "rose" },
  descartado: { label: "Descartado", tone: "slate" },
  duplicado: { label: "Duplicado", tone: "slate" },
};

export const QUALIFICATION: Record<string, { label: string; tone: Tone }> = {
  cualificado: { label: "Cualificado", tone: "emerald" },
  dudoso: { label: "Dudoso", tone: "amber" },
  no_cualificado: { label: "No cualificado", tone: "rose" },
  pendiente: { label: "Pendiente", tone: "slate" },
};

export const CONSULTATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  agendada: { label: "Agendada", tone: "blue" },
  asistida: { label: "Asistida", tone: "emerald" },
  no_asistio: { label: "No asistió", tone: "rose" },
  cancelada: { label: "Cancelada", tone: "slate" },
  reprogramada: { label: "Reprogramada", tone: "amber" },
};

export const CALL_OUTCOME: Record<string, string> = {
  no_contesta: "No contesta",
  buzon: "Buzón de voz",
  numero_erroneo: "Número erróneo",
  volver_a_llamar: "Volver a llamar",
  no_cualificado: "No cualificado",
  no_interesado: "No interesado",
  cita_agendada: "Cita agendada",
};

export const SOURCE: Record<string, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  web: "Web",
  manual: "Manual",
  otro: "Otro",
  google_maps: "Google Maps",
  csv: "CSV",
  reactivacion: "Reactivación",
};

export const EMPLOYMENT: Record<string, string> = {
  asalariado: "Asalariado",
  autonomo: "Autónomo",
  desempleado: "Desempleado",
  pensionista: "Pensionista",
  otro: "Otro",
};

export const ACTIVITY_KIND: Record<string, string> = {
  llamada: "Llamada",
  email: "Email",
  whatsapp: "WhatsApp",
  reunion: "Reunión",
  nota: "Nota",
  estado: "Cambio de estado",
};

export type Tone = "slate" | "blue" | "indigo" | "violet" | "fuchsia" | "emerald" | "amber" | "rose";
