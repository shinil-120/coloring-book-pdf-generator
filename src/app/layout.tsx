import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Coloring Book PDF Generator — KDP-Ready",
  description:
    "Generate Amazon KDP-ready coloring book PDFs from AI-generated images, with a built-in PDF editor for rearranging pages and adding blank pages.",
  keywords: [
    "Coloring Book",
    "PDF Generator",
    "Amazon KDP",
    "AI Image Generation",
    "PDF Editor",
  ],
  authors: [{ name: "Coloring Book Studio" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <SonnerToaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            style: {
              borderRadius: "9999px",
            },
          }}
        />
      </body>
    </html>
  );
}
