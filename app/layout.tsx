import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OfferYou",
  description: "先修改简历，再发现自己，再沉淀长期职业资料。",
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
