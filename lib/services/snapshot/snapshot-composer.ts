import type { ResumeDocument } from "@/lib/document/resume-document";
import type { PersistedWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";

export function composeSnapshotDocument(draft: PersistedWorkspaceDraft): ResumeDocument {
  const acceptedSuggestions = draft.suggestions.filter((suggestion) => suggestion.status === "accepted");
  const pendingFactSubmissions = draft.factSubmissions.filter((item) => item.status === "pending_confirmation");

  return {
    templateKey: "template_a",
    header: {
      name: "OfferYou Candidate",
      title: `${draft.jobTitle} tailored for ${draft.company}`,
      meta: [`Language: ${draft.language}`, `Draft: ${draft.id}`, `Stage: ${draft.stage}`]
    },
    sections: [
      {
        id: "summary",
        title: "Positioning",
        items: [
          `Fit score: ${draft.analysis.fitScore}`,
          ...draft.analysis.strengths
        ]
      },
      {
        id: "accepted-suggestions",
        title: "Accepted Snapshot Blocks",
        items:
          acceptedSuggestions.length > 0
            ? acceptedSuggestions.map((suggestion) => suggestion.afterText)
            : ["No accepted suggestions yet. Accept one or more Mentor Mode changes to build the snapshot."]
      },
      {
        id: "pending-facts",
        title: "Pending Fact Review",
        items:
          pendingFactSubmissions.length > 0
            ? pendingFactSubmissions.map((submission) => submission.submissionText)
            : ["No pending fact submissions."]
      }
    ]
  };
}
