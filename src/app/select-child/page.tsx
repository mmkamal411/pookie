import { redirect } from "next/navigation";
import { getMemberships, setActiveChild } from "@/lib/tenant/actions";
import { StandbyConsole, StandbyConsoleSpacer } from "@/components/standby-console";
import PageGlide from "@/components/page-glide";

// Reads the session — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * Child switcher — rendered ONLY for parent-role users with N memberships.
 * Child-role users never see this (root router sends them straight in).
 */
export default async function SelectChildPage() {
  const memberships = await getMemberships();
  const parents = memberships.filter((m) => m.role === "parent");
  if (parents.length <= 1) redirect("/");

  async function select(formData: FormData) {
    "use server";
    const childId = formData.get("child_id");
    if (typeof childId !== "string") return;
    await setActiveChild(childId);
    const slug = parents.find((m) => m.child_id === childId)?.child.slug;
    redirect(slug ? `/c/${slug}` : "/");
  }

  return (
    <>
    <main className="flex min-h-screen items-center justify-center bg-nebula-950 px-4">
      <PageGlide>
      <div className="w-full max-w-md">
        <p className="animate-bloom text-center text-sm font-medium tracking-[0.2em] text-nova-400 uppercase">
          Pookie
        </p>
        <h1 className="text-sunlit animate-bloom mt-3 text-center text-2xl font-semibold tracking-tight">
          Who's on this mission?
        </h1>
        <div className="mt-8 grid gap-4">
          {parents.map((m, i) => (
            <form
              key={m.child_id}
              action={select}
              className="animate-bloom"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <input type="hidden" name="child_id" value={m.child_id} />
              <button
                type="submit"
                className="card-living neon-pipe flex w-full items-center gap-4 rounded-3xl p-5 text-left"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-nova-500/15 text-xl font-semibold text-nova-300 shadow-glow-sm">
                  {m.child.first_name.charAt(0)}
                </span>
                <span>
                  <span className="block font-medium text-star-100">
                    {m.child.nickname ?? m.child.first_name}
                  </span>
                  <span className="block text-sm text-stardust-300">
                    {[m.child.grade_level, m.child.school_name]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            </form>
          ))}
        </div>
      </div>
      </PageGlide>
      <StandbyConsoleSpacer />
    </main>
    <StandbyConsole label="Select your crew member" />
    </>
  );
}
