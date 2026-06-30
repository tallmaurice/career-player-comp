import type { Metadata } from "next";
import LegalPage from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Career Player Comp",
  description:
    "How Career Player Comp handles your data. Short version: nothing you submit is stored, no tracking cookies, no ads.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="June 30, 2026">
      <p>
        <strong>The short version.</strong> No accounts. We do not store what
        you submit or the report we generate. No tracking cookies, no ads, and
        we do not sell your data.
      </p>

      <h2>Who we are</h2>
      <p>
        Career Player Comp is operated by Drapetomania LLC. You can reach us at{" "}
        <a href="mailto:hello@careerplayercomp.com">
          hello@careerplayercomp.com
        </a>
        .
      </p>

      <h2>What you give us, and what happens to it</h2>
      <p>
        To build your scouting report, you share career information: a resume or
        LinkedIn PDF, or work history you paste in, plus your answers to the
        questions.
      </p>
      <ul>
        <li>
          <strong>PDFs are read in your browser.</strong> When you upload a PDF,
          the file is read on your own device, and only the extracted text is
          sent to us. The file itself never leaves your browser.
        </li>
        <li>
          <strong>Your career details go to our AI provider.</strong> We send
          the text and your answers to Anthropic, the provider that runs the AI
          model that writes your report. Anthropic processes this to return your
          result, and under its commercial API terms it does not use it to train
          its models.
        </li>
        <li>
          <strong>We do not store any of it.</strong> We do not save your inputs
          or the report we generate. Once your result is on screen it lives only
          in your browser, and closing the tab clears it.
        </li>
        <li>
          <strong>Your shareable card</strong> is encoded into the image link
          itself, so it can be created without us storing anything.
        </li>
      </ul>

      <h2>Limited technical information</h2>
      <p>
        Even though we do not store your career data, our servers handle a small
        amount of technical information to keep the site working and to prevent
        abuse:
      </p>
      <ul>
        <li>
          <strong>IP address.</strong> We briefly process your IP address to
          enforce rate limits, so one person cannot overload the scout, and to
          protect against abuse. It is not linked to your career information, not
          used to identify you, and not sold.
        </li>
        <li>
          <strong>Anonymous counts.</strong> We keep simple tallies, such as the
          total number of careers scouted. These are only numbers and contain no
          personal information.
        </li>
      </ul>

      <h2>Payments</h2>
      <p>
        If you choose to tip, the payment is handled by Stripe. We never see or
        store your full card details. How Stripe handles your payment
        information is governed by the Stripe privacy policy.
      </p>

      <h2>Cookies and tracking</h2>
      <p>
        We do not use tracking cookies, analytics, advertising pixels, or
        third-party trackers. Because we set no non-essential cookies, there is
        no cookie consent banner to click through.
      </p>

      <h2>Service providers</h2>
      <p>
        We rely on a few providers, each of which receives only what it needs to
        do its job:
      </p>
      <ul>
        <li>
          <strong>Anthropic</strong> generates your report from your career
          text.
        </li>
        <li>
          <strong>Vercel</strong> hosts the site.
        </li>
        <li>
          <strong>Upstash</strong> powers rate limiting and the anonymous
          counters.
        </li>
        <li>
          <strong>Stripe</strong> processes optional tips.
        </li>
      </ul>

      <h2>Your choices</h2>
      <p>
        Because we do not store your inputs or build a profile of you, there is
        no saved copy of your data for us to look up or delete. If you have a
        question about your privacy, email us at{" "}
        <a href="mailto:hello@careerplayercomp.com">
          hello@careerplayercomp.com
        </a>{" "}
        and we will help.
      </p>

      <h2>Children</h2>
      <p>
        Career Player Comp is not directed to children under 13, and we do not
        knowingly collect information from them.
      </p>

      <h2>Changes</h2>
      <p>
        If we change how this works, we will update this page and the date
        above.
      </p>

      <h2>Contact</h2>
      <p>
        Drapetomania LLC.{" "}
        <a href="mailto:hello@careerplayercomp.com">
          hello@careerplayercomp.com
        </a>
      </p>
    </LegalPage>
  );
}
