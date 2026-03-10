import type { Metadata } from "next";

import { Navbar } from "@/components/ui/navbar";
import { Providers } from "@/components/ui/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Qabil Genealogy",
  description: "Public family tree explorer with reviewed edits",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
