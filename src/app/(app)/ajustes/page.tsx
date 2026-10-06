import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { Badge, Card, Field, PageHeader, Table, Td, btn, input } from "@/components/ui";
import { createUser, toggleUser } from "./actions";
import { appUrl } from "@/lib/appUrl";
import { isFromEnv, secretSetting } from "@/lib/settings";

export default async function Ajustes() {
  const me = await requireUser();
  const users = await query<{ id: string; name: string; email: string; role: string; active: boolean }>("SELECT id, name, email, role, active FROM users ORDER BY created_at");
  const pending = await query<{ n: number }>("SELECT count(*)::int n FROM events WHERE delivered_at IS NULL");
  const base = appUrl() || "http://localhost:3000";
  const apiKey = me.role === "admin" ? await secretSetting("N8N_API_KEY") : null;
  const checks: [string, boolean, string][] = [
    ["N8N_API_KEY", true, isFromEnv("N8N_API_KEY") ? "Clave que usa n8n para llamar a la API" : "Clave que usa n8n para llamar a la API (generada por la app)"],
    ["N8N_EVENTS_WEBHOOK_URL", !!process.env.N8N_EVENTS_WEBHOOK_URL, "Webhook de n8n que recibe eventos (lead nuevo, cita agendada…)"],
    ["APP_URL", !!appUrl(), "URL pública de la app (enlaces de confirmación para los despachos)"],
    ["SESSION_SECRET", true, isFromEnv("SESSION_SECRET") ? "Firma de las sesiones" : "Firma de las sesiones (generada por la app)"],
  ];
  const endpoints = [
    ["POST", "/api/v1/prospects", "Alta de despachos desde Apify (Google Maps)"],
    ["GET", "/api/v1/prospects/pending", "Despachos pendientes de analizar"],
    ["POST", "/api/v1/prospects/enrich", "Resultado del análisis de web, Instagram y anuncios de Meta"],
    ["POST", "/api/v1/leads", "Entrada de leads (Meta, Google, web)"],
    ["GET", "/api/v1/consultations/reminders", "Citas que necesitan recordatorio"],
    ["GET", "/api/v1/consultations/unconfirmed", "Citas pasadas sin confirmar (enlace para el despacho)"],
    ["POST", "/api/v1/consultations/:id", "Marcar recordatorio enviado / estado de la cita"],
    ["GET", "/api/v1/billing?month=AAAA-MM", "Resumen de facturación para el informe mensual"],
    ["GET", "/api/v1/events", "Eventos no entregados (respaldo del webhook)"],
    ["GET", "/api/v1/clients", "Lista de clientes"],
  ];
  return (
    <>
      <PageHeader title="Ajustes e integraciones" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Estado de la configuración">
          <ul className="space-y-2 text-sm">
            {checks.map(([k, ok, d]) => (
              <li key={k} className="flex items-start justify-between gap-3">
                <div><code className="text-xs font-semibold">{k}</code><div className="text-xs text-slate-500">{d}</div></div>
                <Badge tone={ok ? "emerald" : "rose"}>{ok ? "OK" : "Falta"}</Badge>
              </li>
            ))}
            <li className="flex items-center justify-between border-t border-slate-100 pt-2">
              <span>Eventos pendientes de entregar a n8n</span>
              <Badge tone={pending[0].n ? "amber" : "emerald"}>{pending[0].n}</Badge>
            </li>
          </ul>
        </Card>
        <Card title="API para n8n">
          <p className="mb-3 text-xs text-slate-500">Todas las llamadas llevan la cabecera <code>x-api-key</code>. Copia estos dos datos en el nodo <b>Config</b> de cada flujo de n8n.</p>
          <dl className="mb-4 space-y-2 text-xs">
            <div><dt className="text-slate-500">Dirección de la app (LH_API_URL)</dt><dd className="mt-0.5 select-all break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-ink">{base}</dd></div>
            {apiKey && <div><dt className="text-slate-500">Clave de la API (N8N_API_KEY)</dt><dd className="mt-0.5 select-all break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-ink">{apiKey}</dd></div>}
          </dl>
          <ul className="space-y-1.5 text-xs">
            {endpoints.map(([m, p, d]) => (
              <li key={p} className="flex gap-2">
                <span className={`w-11 shrink-0 font-mono font-bold ${m === "GET" ? "text-emerald-600" : "text-indigo-600"}`}>{m}</span>
                <span className="font-mono text-slate-800">{p}</span>
                <span className="text-slate-500">· {d}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Equipo" className="lg:col-span-2">
          <Table head={["Nombre", "Email", "Rol", "Estado", ""]}>
            {users.map((u) => (
              <tr key={u.id}>
                <Td className="font-medium">{u.name}</Td>
                <Td>{u.email}</Td>
                <Td>{u.role === "admin" ? "Administrador" : "Telefonista"}</Td>
                <Td><Badge tone={u.active ? "emerald" : "slate"}>{u.active ? "Activo" : "Desactivado"}</Badge></Td>
                <Td>{me.role === "admin" && u.id !== me.id && <form action={toggleUser.bind(null, u.id)}><button className={btn.ghost}>{u.active ? "Desactivar" : "Activar"}</button></form>}</Td>
              </tr>
            ))}
          </Table>
          {me.role === "admin" && (
            <form action={createUser} className="mt-4 grid gap-3 sm:grid-cols-5">
              <Field label="Nombre"><input name="name" required className={input} /></Field>
              <Field label="Email"><input name="email" type="email" required className={input} /></Field>
              <Field label="Contraseña"><input name="password" type="password" minLength={8} required className={input} /></Field>
              <Field label="Rol">
                <select name="role" className={input}><option value="caller">Telefonista</option><option value="admin">Administrador</option></select>
              </Field>
              <div className="flex items-end"><button className={`${btn.primary} w-full`}>Añadir usuario</button></div>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
