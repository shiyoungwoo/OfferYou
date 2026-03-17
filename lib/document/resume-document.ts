export type ResumeDocumentHeader = {
  name: string;
  title: string;
  meta: string[];
};

export type ResumeDocumentSection = {
  id: string;
  title: string;
  items: string[];
};

export type ResumeDocument = {
  templateKey: string;
  header: ResumeDocumentHeader;
  sections: ResumeDocumentSection[];
};
