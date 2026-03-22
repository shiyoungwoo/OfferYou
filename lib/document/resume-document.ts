export type ResumeDocumentHeader = {
  name: string;
  title: string;
  meta: string[];
  contacts?: string[];
  photo?: {
    mode: "placeholder" | "uploaded";
    label: string;
    src?: string;
  };
};

export type ResumeDocumentTextItem = {
  type: "text";
  text: string;
};

export type ResumeDocumentEntryItem = {
  type: "entry";
  heading: string;
  meta?: string;
  subheading?: string;
  summary?: string;
  bullets?: string[];
};

export type ResumeDocumentItem = ResumeDocumentTextItem | ResumeDocumentEntryItem;

export type ResumeDocumentSection = {
  id: string;
  title: string;
  items: ResumeDocumentItem[];
  tone?: "hero" | "standard" | "muted";
};

export type ResumeDocument = {
  templateKey: string;
  header: ResumeDocumentHeader;
  sections: ResumeDocumentSection[];
};
