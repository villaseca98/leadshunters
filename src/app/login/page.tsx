import { redirect } from "next/navigation";
import { getUser, login } from "@/lib/auth";
import { btn, input, label } from "@/components/ui";

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
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-3xl font-bold tracking-tight text-white">
            Leads<span className="text-indigo-400">Hunters</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">Clientes para despachos de Segunda Oportunidad</p>
        </div>
        <form action={doLogin} className="space-y-4 rounded-2xl bg-white p-6 shadow-xl">
          {sp.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">Email o contraseña incorrectos.</p>}
          <div>
            <label className={label} htmlFor="email">Email</label>
            <input className={input} id="email" name="email" type="email" required autoFocus autoComplete="username" />
          </div>
          <div>
            <label className={label} htmlFor="password">Contraseña</label>
            <input className={input} id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <button className={`${btn.primary} w-full`}>Entrar</button>
        </form>
      </div>
    </main>
  );
}
