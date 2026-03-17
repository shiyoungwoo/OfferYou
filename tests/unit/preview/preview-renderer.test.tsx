import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TemplateA } from "@/components/preview/template-a";

describe("TemplateA", () => {
  it("renders section headings from ResumeDocument", () => {
    render(
      <TemplateA
        document={{
          templateKey: "template_a",
          header: { name: "User", title: "AI Product Manager", meta: [] },
          sections: [{ id: "projects", title: "Projects", items: [] }]
        }}
      />
    );

    expect(screen.getByText("Projects")).toBeTruthy();
  });
});
