import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';

export const Route = createFileRoute('/terms')({
  head: () => ({
    meta: [
      { title: 'Terms & Conditions — VibTribe' },
      { name: 'description', content: 'VibTribe Terms of Service governing use of our private messaging platform.' },
      { property: 'og:title', content: 'Terms & Conditions — VibTribe' },
      { property: 'og:description', content: 'Read the Terms of Service for the VibTribe messaging app.' },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/sign-up" className="p-2 -ml-2 rounded-lg hover:bg-muted">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="font-semibold">Terms &amp; Conditions</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 prose prose-invert text-sm leading-relaxed">
        <p className="text-muted-foreground">Last updated: 24 May 2026</p>

        <h2 className="text-lg font-semibold mt-6">1. Acceptance of Terms</h2>
        <p>By creating an account or using VibTribe ("the App", "we", "us", "our"), you agree to these Terms &amp; Conditions and our Privacy Policy. If you do not agree, you must not use the App.</p>

        <h2 className="text-lg font-semibold mt-6">2. Eligibility</h2>
        <p>You must be at least 13 years old (or the minimum digital-consent age in your country) to use VibTribe. By signing up you confirm that the information you provide is accurate and that you are legally permitted to use the service.</p>

        <h2 className="text-lg font-semibold mt-6">3. Your Account</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>You are responsible for safeguarding your password and 6-digit encryption PIN.</li>
          <li>If you lose your encryption PIN, your encrypted message history cannot be recovered.</li>
          <li>You must not share your account or impersonate others.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6">4. Acceptable Use</h2>
        <p>You agree not to use VibTribe to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Send spam, scams, phishing, or unsolicited bulk messages.</li>
          <li>Share illegal content, child sexual abuse material, terrorism-related content, or anything that violates Indian law or the IT Act, 2000.</li>
          <li>Harass, threaten, defame, or stalk any person.</li>
          <li>Distribute malware or attempt to break, probe, or reverse-engineer the platform.</li>
          <li>Infringe intellectual-property rights or share content you do not own or have permission to share.</li>
          <li>Use the App for any commercial purpose without our written consent.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6">5. Encryption &amp; Privacy</h2>
        <p>VibTribe applies strong end-to-end encryption to one-to-one messages and media using keys derived on your device from your PIN. We do not have the ability to read end-to-end encrypted content. However, certain metadata (e.g. account identifiers, timestamps, delivery status) is necessarily processed on our servers to deliver the service. See our <Link to="/privacy" className="text-primary underline">Privacy Policy</Link> for details.</p>

        <h2 className="text-lg font-semibold mt-6">6. User Content</h2>
        <p>You retain ownership of the content you send. You grant us a limited licence to transmit, store, and display that content solely to operate the App. We do not claim ownership of your messages, media, or status updates.</p>

        <h2 className="text-lg font-semibold mt-6">7. Suspension &amp; Termination</h2>
        <p>We may suspend or terminate your account at any time, with or without notice, if we reasonably believe you have violated these Terms, applicable law, or if your account poses a security or safety risk to other users.</p>

        <h2 className="text-lg font-semibold mt-6">8. Disclaimers</h2>
        <p>The App is provided "as is" and "as available". To the maximum extent permitted by law we disclaim all warranties, express or implied, including merchantability, fitness for purpose, and non-infringement. We do not guarantee uninterrupted, error-free, or perfectly secure operation.</p>

        <h2 className="text-lg font-semibold mt-6">9. Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, VibTribe and its operators are not liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, data, or goodwill arising out of your use of the App.</p>

        <h2 className="text-lg font-semibold mt-6">10. Compliance with Indian Law</h2>
        <p>VibTribe operates as an intermediary under the Information Technology Act, 2000, and related rules. We comply with lawful requests from authorised Indian government agencies. The Digital Personal Data Protection framework applies to personal data we process about Indian users.</p>

        <h2 className="text-lg font-semibold mt-6">11. Changes to These Terms</h2>
        <p>We may update these Terms from time to time. Material changes will be communicated in-app. Continued use of the App after changes take effect constitutes acceptance.</p>

        <h2 className="text-lg font-semibold mt-6">12. Governing Law</h2>
        <p>These Terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the competent courts in India.</p>

        <h2 className="text-lg font-semibold mt-6">13. Grievance Officer / Contact</h2>
        <p>For complaints, takedown requests, or grievances under the IT Rules, contact:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Support: support@vibtribe.in</li>
          <li>Privacy: privacy@vibtribe.in</li>
          <li>Legal / Grievance: legal@vibtribe.in</li>
        </ul>

        <div className="mt-10">
          <Link to="/sign-up" className="text-primary underline">← Back to Sign Up</Link>
        </div>
      </main>
    </div>
  );
}
