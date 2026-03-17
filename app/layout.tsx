import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OfferYou V2",
  description: "Productized MVP for AI-assisted resume tailoring"
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
