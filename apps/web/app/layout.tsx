import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LM-3D | Impressoes 3D personalizadas",
    template: "%s | LM-3D"
  },
  description:
    "E-commerce da LM-3D para produtos impressos em 3D, presentes criativos e pecas sob encomenda.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
