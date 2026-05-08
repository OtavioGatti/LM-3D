import type { Metadata } from "next";
import "./globals.css";

function getMetadataBase() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    return new URL(appUrl || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  title: {
    default: "LM-3D | Impressões 3D personalizadas",
    template: "%s | LM-3D"
  },
  description:
    "E-commerce da LM-3D para produtos impressos em 3D, presentes criativos e peças sob encomenda.",
  metadataBase: getMetadataBase()
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
