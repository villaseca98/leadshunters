import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    await query("SELECT 1");
    return NextResponse.json({ ok: true, db: "ok" });
  } catch (e) {
    return NextResponse.json({ ok: false, db: (e as Error).message }, { status: 500 });
  }
}
