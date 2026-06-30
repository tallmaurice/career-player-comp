import type { Metadata } from "next";
import LegalPage from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — Career Player Comp",
  description:
    "The terms for using Career Player Comp. It is an entertainment toy, not advice, and not affiliated with the NBA, WNBA, or any player.",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="June 30, 2026">
      <p>
        <strong>The short version.</strong> This is an entertainment toy. The
        comp is AI-generated for fun, it is not advice, and we are not affiliated
        with the NBA, WNBA, or any player. Be cool, and do not abuse it.
      </p>

      <h2>Agreement</h2>
      <p>
        By using Career Player Comp, the Service operated by Drapetomania LLC,
        you agree to these terms. If you do not agree, please do not use it.
      </p>

      <h2>What this is</h2>
      <p>
        Career Player Comp generates a playful scouting report that compares your
        career to a professional basketball player. It is for entertainment
        only. It is not career, financial, professional, or any other kind of
        advice, and the AI can be wrong, incomplete, or strange. Do not make real
        decisions based on it.
      </p>
      <p>
        We are not affiliated with, endorsed by, or sponsored by the NBA, the
        WNBA, any team, any player, or any video game. Player names are used for
        commentary and parody.
      </p>

      <h2>Who can use it</h2>
      <p>
        You must be at least 13 years old to use the Service. If you make a tip,
        you must be old enough to use the payment method and authorized to do so.
      </p>

      <h2>Acceptable use</h2>
      <p>Please do not:</p>
      <ul>
        <li>
          submit personal information about other people without their
          permission;
        </li>
        <li>try to overload, scrape, reverse-engineer, or break the Service;</li>
        <li>use it for anything unlawful, harassing, or harmful.</li>
      </ul>

      <h2>Your input</h2>
      <p>
        You keep ownership of the career information you submit. You give us
        permission to process it as described in our{" "}
        <a href="/privacy">Privacy Policy</a> for the single purpose of
        generating your report. You are responsible for what you submit, and you
        confirm you have the right to share it.
      </p>

      <h2>Our content and brand</h2>
      <p>
        The Service, including the Career Player Comp name, the scouting-report
        format, the design, the code, and the generated layout, is owned by
        Drapetomania LLC and protected by intellectual property laws. The report
        we generate for you is yours to share for personal, non-commercial use.
        Please do not copy or resell the Service itself.
      </p>

      <h2>Tips</h2>
      <p>
        Tips are voluntary and are processed by Stripe. A tip is a contribution
        that helps cover costs, not a purchase of any product or service, and
        tips are non-refundable.
      </p>

      <h2>No warranty</h2>
      <p>
        The Service is provided on an as-is and as-available basis, without
        warranties of any kind. We do not promise that it will always be
        available, accurate, or error-free.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent allowed by law, Drapetomania LLC will not be liable
        for any indirect, incidental, or consequential damages arising from your
        use of the Service. Where liability cannot be excluded, it is limited to
        the amount you paid us, if any, in the twelve months before the claim.
      </p>

      <h2>Changes</h2>
      <p>
        We may update the Service or these terms. If we change the terms we will
        update the date above, and continuing to use the Service means you accept
        the change.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the State of New Jersey, without
        regard to its conflict-of-laws rules.
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
