import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://careerplayercomp.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  title: "Career Player Comp",
  description:
    "Find out which NBA player your career makes you. Upload your LinkedIn, answer 8 questions, get a scouting report that reads your work history the way a front office reads a prospect. No account, nothing stored.",
  openGraph: {
    title: "Career Player Comp — What player is your career?",
    description:
      "A scouting report that reads your work history the way a front office reads a prospect. No account, nothing stored.",
    url: SITE_URL,
    siteName: "Career Player Comp",
    type: "website",
    images: [
      {
        // Default OG image (bare-domain share). Rendered server-side by
        // /api/og — headline + a sample scouting card — so the link preview
        // shows the payoff. Per-comp cards have their own image via /api/card.
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Career Player Comp scouting report",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Career Player Comp — What player is your career?",
    description:
      "A scouting report that reads your work history the way a front office reads a prospect.",
    images: ["/api/og"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* The fonts live in /public/fonts (see the top of globals.css). These three are on every first screen. */}
        <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/barlow-condensed-700-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/jetbrains-mono-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
