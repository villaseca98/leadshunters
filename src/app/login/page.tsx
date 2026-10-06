import { redirect } from "next/navigation";
import { getUser, login } from "@/lib/auth";
import { btn } from "@/components/ui";
import { Logo } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

async function doLogin(formData: FormData) {
  "use server";
  const ok = await login(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
  redirect(ok ? "/" : "/login?error=1");
}

export default async function LoginPage(props: PageProps<"/login">) {
  if (await getUser()) redirect("/");
  const sp = await props.searchParams;
  return (
    <main className="flex min-h-dvh flex-col bg-ink px-5 text-white" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
        <svg viewBox="0 0 200 200" className="pointer-events-none absolute -right-24 top-6 size-80 opacity-20" aria-hidden>
          <circle cx="100" cy="100" r="96" fill="none" stroke="#ff5b1a" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="64" fill="none" stroke="#ff5b1a" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="32" fill="none" stroke="#ff5b1a" strokeWidth="1.5" />
          <path d="M100 0v200M0 100h200" stroke="#ff5b1a" strokeWidth="1.5" />
        </svg>
        <div className="relative">
          <Logo dark />
          <h1 className="font-display mt-10 text-4xl font-semibold leading-[1.05]">Cada minuto<br /><span className="text-blaze">cuenta.</span></h1>
          <p className="mt-3 text-sm text-white/60">Leads de Segunda Oportunidad llamados en menos de 5 minutos.</p>
        </div>
        <form action={doLogin} className="relative mt-10 space-y-3">
          {sp.error && <p className="rounded-2xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">Email o contraseña incorrectos.</p>}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-white/60">Email</span>
            <input className={dark} id="email" name="email" type="email" required autoFocus autoComplete="username" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-white/60">Contraseña</span>
            <input className={dark} id="password" name="password" type="password" required autoComplete="current-password" />
          </label>
          <button className={`${btn.hunt} mt-2 min-h-14 w-full text-base`}>Entrar</button>
        </form>
      </div>
    </main>
  );
}

const dark = "block min-h-12 w-full rounded-2xl border-0 bg-white/10 px-4 text-base text-white ring-1 ring-inset ring-white/15 placeholder:text-white/30 focus:bg-white/15 focus:ring-2 focus:ring-blaze";
