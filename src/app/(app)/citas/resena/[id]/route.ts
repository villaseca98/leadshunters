// Abre WhatsApp con el mensaje para pedir la reseña en Google y lo deja marcado como pedido.
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { reviewMessage } from "@/lib/review";

export async function GET(req: Request, ctx: RouteContext<"/citas/resena/[id]">) {
  if (!(await getUser())) return NextResponse.redirect(new URL("/login", req.url));
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("No encontrada", { status: 404 });
  const r = await queryOne<{ full_name: string; phone: string | null; name: string; google_review_url: string | null }>(
    `UPDATE consultations co SET review_requested_at = coalesce(co.review_requested_at, now())
       FROM leads l, clients c WHERE co.id = $1 AND l.id = co.lead_id AND c.id = co.client_id AND co.status = 'asistida'
     RETURNING l.full_name, l.phone, c.name, c.google_review_url`,
    [id],
  );
  if (!r?.google_review_url || !r.phone) return NextResponse.redirect(new URL("/citas?ver=todas", req.url));
  const phone = r.phone.replace(/\D/g, "");
  return NextResponse.redirect(`https://wa.me/${phone}?text=${encodeURIComponent(reviewMessage(r.full_name, r.name, r.google_review_url))}`);
}
