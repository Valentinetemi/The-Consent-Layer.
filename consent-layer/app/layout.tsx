import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Consent Layer — Agent capability, human authority",
  description:
    "A transparent, agent-assisted scholarship application with a technically enforced human consent boundary.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
