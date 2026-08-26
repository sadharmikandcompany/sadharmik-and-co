import type { Metadata } from "next";
import { Cormorant_Garamond, Mukta } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cormorant",
});

const mukta = Mukta({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-mukta",
});

export const metadata: Metadata = {
  title: "Sadharmik & Co. — CRM",
  description: "Internal order, customer and stock management for Sadharmik & Co.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${mukta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
