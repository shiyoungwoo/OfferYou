const fieldClassName =
  "w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-accent";

export function NewApplicationForm() {
  return (
    <form className="grid gap-6 rounded-[2rem] border border-line bg-white/90 p-8 shadow-card">
      <div className="grid gap-6 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Company
          <input className={fieldClassName} defaultValue="OfferYou" name="company" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Job Title
          <input className={fieldClassName} defaultValue="AI Product Manager" name="jobTitle" />
        </label>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Language
          <select className={fieldClassName} defaultValue="en" name="language">
            <option value="en">English</option>
            <option value="zh">Chinese</option>
            <option value="auto">Auto</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Existing Master
          <select className={fieldClassName} defaultValue="default-master" name="masterResumeId">
            <option value="default-master">Default Master Resume</option>
          </select>
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Resume File Reference
        <input
          className={fieldClassName}
          defaultValue="manual://placeholder-resume"
          name="resumeAssetRef"
          placeholder="upload://resume.pdf"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        JD Content
        <textarea
          className={`${fieldClassName} min-h-56 resize-y`}
          defaultValue="We need an AI product manager who can define workflows, turn ambiguity into systems, and ship AI-assisted user journeys."
          name="jdContent"
        />
      </label>

      <div className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-line bg-paper px-5 py-4">
        <p className="text-sm leading-6 text-slate-700">
          This form is wired to the draft creation route next. File upload and Master selection will move from
          placeholder fields to live persistence in the next implementation slice.
        </p>
        <button
          className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
          type="submit"
        >
          Create Draft
        </button>
      </div>
    </form>
  );
}
