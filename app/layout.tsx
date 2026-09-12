import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Redline: find out what signing costs you",
  description:
    "Redline reads a document you cannot negotiate and shows you the clauses that could hurt you, each quoting the exact sentence it came from.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
