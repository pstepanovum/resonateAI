import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

// Define the Roboto font
const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "ResonateAI | Neural Music Generation Research",
  description: "Research project exploring AI-powered music generation with neuroscience principles",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={roboto.variable}>
      <body className="antialiased font-roboto bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}