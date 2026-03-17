import { NewApplicationForm } from "@/components/applications/new-application-form";

export default function NewApplicationPage() {
  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-card">
          <p className="text-sm uppercase tracking-[0.3em] text-accent">New Application</p>
          <h1 className="mt-4 text-4xl font-semibold">Create a new job-tailoring draft.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700">
            Start with a company, a role, a JD, and either a resume file reference or an existing Master. The next
            phase will attach live file uploads and analysis generation to this route.
          </p>
        </header>

        <NewApplicationForm />
      </section>
    </main>
  );
}
