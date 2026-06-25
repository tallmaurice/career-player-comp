import type { Metadata } from "next";
import { Barlow_Condensed, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Display: player names, archetype titles, headings.
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

// Body: copy, quiz options, UI.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

// Mono: labels, file numbers, stat lines, scouting notation.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://careerplayercomp.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
        // Static generic OG image for v1 (keeps the no-storage promise; the
        // personalized card travels via the user-downloaded PNG). Add this asset
        // to /public before launch.
        url: "/og-default.png",
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
    images: ["/og-default.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${barlowCondensed.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
