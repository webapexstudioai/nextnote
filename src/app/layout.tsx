import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nextnote.to"),
  title: {
    default: "NextNote — The CRM built for closing",
    template: "%s · NextNote",
  },
  description:
    "NextNote turns prospects into closed deals. Pipeline, follow-ups, bookings, and AI outreach in one sharp, focused CRM.",
  applicationName: "NextNote",
  keywords: ["CRM", "sales pipeline", "prospect management", "AI outreach", "closing deals", "lead management"],
  authors: [{ name: "NextNote" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "https://nextnote.to",
    siteName: "NextNote",
    title: "NextNote — The CRM built for closing",
    description:
      "Pipeline, follow-ups, bookings, and AI outreach in one sharp, focused CRM. Turn prospects into closed deals.",
    images: [{ url: "/nextnote-logo.png", width: 1200, height: 630, alt: "NextNote" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NextNote — The CRM built for closing",
    description:
      "Pipeline, follow-ups, bookings, and AI outreach in one sharp, focused CRM.",
    images: ["/nextnote-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
