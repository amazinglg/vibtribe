import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: [
      { title: 'Privacy Policy — VibTribe' },
      { name: 'description', content: 'How VibTribe collects, uses, and protects your data, including end-to-end encryption details.' },
      { property: 'og:title', content: 'Privacy Policy — VibTribe' },
      { property: 'og:description', content: 'Privacy Policy for the VibTribe messaging app.' },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/sign-up" className="p-2 -ml-2 rounded-lg hover:bg-muted">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="font-semibold">Privacy Policy</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 prose prose-invert text-sm leading-relaxed">
        <p className="text-muted-foreground">Last updated: 24 May 2026</p>

        <p>VibTribe ("we", "us", "our") is a privacy-first messaging app. This Policy explains what data we collect, how we use it, and the choices you have. By using the App you agree to this Policy.</p>

        <h2 className="text-lg font-semibold mt-6">1. Data We Collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Account data:</strong> mobile number, country code, username, display name, optional avatar, optional email.</li>
          <li><strong>Encryption material:</strong> your ECDH public key, and your private key <em>wrapped (encrypted) with a key derived from your 6-digit PIN</em>. We never store your PIN or the unwrapped private key.</li>
          <li><strong>Messages &amp; media:</strong> one-to-one messages and media are end-to-end encrypted on your device and stored on our servers only in encrypted form.</li>
          <li><strong>Contacts:</strong> contact name entries you create inside the app. We do not upload your phone address book.</li>
          <li><strong>Status updates:</strong> stored for 24 hours then automatically deleted.</li>
          <li><strong>Presence &amp; technical data:</strong> last-seen timestamp, online status, device push-subscription token, basic error logs.</li>
          <li><strong>Support tickets:</strong> any information you submit through the help/support form.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6">2. What We Do <em>Not</em> Collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>We do not read or sell the contents of your end-to-end encrypted messages or media.</li>
          <li>We do not upload your phone contact list.</li>
          <li>We do not track your precise location.</li>
          <li>We do not run third-party advertising trackers.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6">3. Encryption Approach</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Key exchange: ECDH on the NIST P-256 curve, performed in your browser via the Web Crypto API.</li>
          <li>Message &amp; media encryption: AES-GCM-256 with a fresh random IV per payload.</li>
          <li>Private-key protection: your private key is wrapped with an AES-GCM key derived from your 6-digit PIN using PBKDF2-SHA256 (100,000 iterations) before being stored on our servers.</li>
          <li>Because the PIN never leaves your device, our servers cannot decrypt your messages or media. If you forget your PIN, encrypted history cannot be recovered.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6">4. How We Use Data</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>To create and maintain your account.</li>
          <li>To deliver messages, media, calls, and notifications.</li>
          <li>To provide presence, delivery, and read receipts.</li>
          <li>To detect abuse, spam, and security incidents.</li>
          <li>To respond to support requests and legal obligations.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6">5. Data Retention</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Encrypted messages persist until deleted by you or the chat&apos;s disappearing-message timer.</li>
          <li>Statuses auto-delete after 24 hours.</li>
          <li>Account data is retained while your account is active.</li>
          <li>You may delete your account from in-app settings; this removes your profile, contacts, encrypted keys, and revokes future delivery to your account.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6">6. Account Deletion</h2>
        <p>To delete your account, use the in-app "Delete Account" option in Profile settings, or email <strong>privacy@vibtribe.in</strong>. Backups and operational logs may persist for a short period for security and legal reasons.</p>

        <h2 className="text-lg font-semibold mt-6">7. Third-Party Services</h2>
        <p>To operate the App we use the following processors. They process data on our behalf and are bound by data-protection terms:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Supabase (managed backend, authentication, database, file storage, realtime).</li>
          <li>Web Push providers (browser push notification delivery, when you opt in).</li>
          <li>Hosting/CDN providers for serving the web app.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6">8. Permissions</h2>
        <p>The App may request the following device permissions, only when you use the related feature:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Camera &amp; microphone — for sending photos, voice notes, and voice/video calls.</li>
          <li>Notifications — to alert you of new messages and calls.</li>
          <li>Storage / file access — to attach files you choose.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6">9. Children</h2>
        <p>The App is not intended for children below the minimum digital-consent age in their jurisdiction (13 in many countries). We do not knowingly collect data from such children.</p>

        <h2 className="text-lg font-semibold mt-6">10. Security</h2>
        <p>We use HTTPS in transit, row-level security on our database, and end-to-end encryption for chats. No service can guarantee absolute security; please use a strong PIN and keep your device secure.</p>

        <h2 className="text-lg font-semibold mt-6">11. Your Rights</h2>
        <p>Subject to applicable law (including India&apos;s Digital Personal Data Protection framework), you may request access, correction, or deletion of your personal data, and may withdraw consent. Contact <strong>privacy@vibtribe.in</strong>.</p>

        <h2 className="text-lg font-semibold mt-6">12. Changes to This Policy</h2>
        <p>We may update this Policy. Material changes will be notified in-app. Continued use after changes means you accept the updated Policy.</p>

        <h2 className="text-lg font-semibold mt-6">13. Grievance Officer / Contact</h2>
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
