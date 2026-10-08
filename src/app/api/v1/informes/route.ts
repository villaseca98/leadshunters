// GET /api/v1/informes?mes=YYYY-MM — informe interno de despachos, luz y placas (para que n8n te lo mande). Cabecera x-api-key.
import { NextResponse } from "next/server";
import { apiKeyFrom, bad, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { currentMonth, monthLabel } from "@/lib/format";
import { reportInsights, reportText } from "@/lib/insights";
import { buildReport } from "@/lib/services/reports";

export async function GET(req: Request) {
  if (!(await isMasterKey(apiKeyFrom(req)))) return unauthorized();
  const mes = new URL(req.url).searchParams.get("mes") || currentMonth();
  if (!/^\d{4}-\d{2}$/.test(mes)) return bad("Mes no válido (AAAA-MM)");
  const report = await buildReport(mes);
  const insights = reportInsights(report);
  return NextResponse.json({ ok: true, mes, informe: report, mejoras: insights, texto: reportText(report, monthLabel(mes), insights) });
}
