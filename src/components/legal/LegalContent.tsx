import { Link } from '@tanstack/react-router';

/**
 * Full Terms & Conditions + Privacy Policy content.
 * Rendered both on the public /terms and /privacy pages and inside the
 * mandatory acceptance modal shown to users who haven't accepted yet.
 */
export function TermsContent() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
      <p className="text-muted-foreground">Last updated: 24 May 2026</p>

      <h2 className="text-lg font-semibold mt-6">1. Acceptance of Terms</h2>
      <p>By creating an account or using VibTribe ("the App", "we", "us", "our"), you agree to these Terms &amp; Conditions and our Privacy Policy. If you do not agree, you must not use the App.</p>

      <h2 className="text-lg font-semibold mt-6">2. Eligibility</h2>
      <p>You must be at least <strong>18 years of age</strong> to create an account or use VibTribe. By signing up you confirm that you are 18 years or older, that the information you provide (including your date of birth) is accurate, and that you are legally permitted to use the service. Accounts found to belong to users under 18 will be terminated.</p>

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
      <p>VibTribe applies strong end-to-end encryption to one-to-one chat messages and media using keys derived on your device from your PIN. We do not have the ability to read end-to-end encrypted message or media content. However, certain metadata (such as account identifiers, timestamps, delivery status, and message-size information) is necessarily processed on our servers to deliver the service. Group chats, call signalling, presence, status updates, and support tickets are NOT end-to-end encrypted today; they are protected in transit (HTTPS) and at rest by access controls. See our <Link to="/privacy" className="text-primary underline">Privacy Policy</Link> for full details.</p>

      <h2 className="text-lg font-semibold mt-6">6. User Content</h2>
      <p>You retain ownership of the content you send. You grant us a limited licence to transmit, store, and display that content solely to operate the App. We do not claim ownership of your messages, media, or status updates.</p>

      <h2 className="text-lg font-semibold mt-6">7. Suspension &amp; Termination</h2>
      <p>We may suspend or terminate your account at any time, with or without notice, if we reasonably believe you have violated these Terms, applicable law, or if your account poses a security or safety risk to other users. You may delete your own account at any time from Profile &rarr; Danger Zone &rarr; Delete My Account.</p>

      <h2 className="text-lg font-semibold mt-6">8. Disclaimers</h2>
      <p>The App is provided "as is" and "as available". To the maximum extent permitted by law we disclaim all warranties, express or implied, including merchantability, fitness for purpose, and non-infringement. We do not guarantee uninterrupted, error-free, or perfectly secure operation.</p>

      <h2 className="text-lg font-semibold mt-6">9. Limitation of Liability</h2>
      <p>To the maximum extent permitted by law, VibTribe and its operators are not liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, data, or goodwill arising out of your use of the App.</p>

      <h2 className="text-lg font-semibold mt-6">10. Compliance with Indian Law</h2>
      <p>VibTribe operates as an intermediary under the Information Technology Act, 2000, and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021. We comply with lawful requests from authorised Indian government agencies. The Digital Personal Data Protection Act, 2023 applies to personal data we process about Indian users.</p>

      <h2 className="text-lg font-semibold mt-6">11. Changes to These Terms</h2>
      <p>We may update these Terms from time to time. Material changes will be communicated in-app and you may be asked to accept the updated Terms again. Continued use of the App after changes take effect constitutes acceptance.</p>

      <h2 className="text-lg font-semibold mt-6">12. Governing Law</h2>
      <p>These Terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the competent courts in India.</p>

      <h2 className="text-lg font-semibold mt-6">13. Grievance Officer / Contact</h2>
      <p>In accordance with the Information Technology Act, 2000 and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the Grievance Officer for VibTribe is:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Name:</strong> Labhansh Garg</li>
        <li><strong>Email:</strong> Labhansh.garg@outlook.com</li>
        <li><strong>Postal address for grievances:</strong> Labhansh Garg, c/o VibTribe Grievance Office — please request the current postal address by emailing Labhansh.garg@outlook.com.</li>
      </ul>
      <p className="text-xs text-muted-foreground">All grievances will be acknowledged within 24 hours and resolved within 15 days of receipt, as required by law.</p>

      <h2 className="text-xl font-bold mt-10 border-t border-border pt-6">Privacy Policy</h2>
      <p>VibTribe is a privacy-first messaging app. This section explains what data we collect, how we use it, and the choices you have.</p>

      <h3 className="text-base font-semibold mt-4">A. Data We Collect</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Account data:</strong> mobile number, country code, username, display name, optional avatar, optional email.</li>
        <li><strong>Date of birth:</strong> collected to verify you are 18 or older. Your date of birth is kept <strong>strictly confidential</strong> — it is visible only to you and to our authorised support / admin team, and is never shown to other users of the App.</li>
        <li><strong>Encryption material:</strong> your ECDH public key, and your private key wrapped (encrypted) with a key derived from your 6-digit PIN. We never store your PIN or the unwrapped private key.</li>
        <li><strong>Messages &amp; media (1:1):</strong> end-to-end encrypted on your device; stored on our servers only in encrypted form.</li>
        <li><strong>Contacts:</strong> contact name entries you create inside the app. We do not upload your phone address book.</li>
        <li><strong>Status updates:</strong> stored for 24 hours then automatically deleted.</li>
        <li><strong>Presence &amp; technical data:</strong> last-seen timestamp, online status, device push-subscription token, basic error logs.</li>
        <li><strong>Support tickets:</strong> any information you submit through the help/support form.</li>
      </ul>

      <h3 className="text-base font-semibold mt-4">B. What We Do <em>Not</em> Collect</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li>We do not read or sell the contents of your end-to-end encrypted 1:1 messages or media.</li>
        <li>We do not expose your date of birth, real email, or mobile number to other users of the App.</li>
        <li>We do not upload your phone contact list.</li>
        <li>We do not track your precise location.</li>
        <li>We do not run third-party advertising trackers.</li>
      </ul>

      <h3 className="text-base font-semibold mt-4">C. Encryption Approach</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li>Key exchange: ECDH on the NIST P-256 curve via the Web Crypto API.</li>
        <li>Message &amp; media encryption: AES-GCM-256 with a fresh random IV per payload.</li>
        <li>Private-key protection: your private key is wrapped with an AES-GCM key derived from your 6-digit PIN using PBKDF2-SHA256 (100,000 iterations) before being stored on our servers.</li>
        <li>If you forget your PIN, encrypted chat history cannot be recovered.</li>
      </ul>

      <h3 className="text-base font-semibold mt-4">D. Account Deletion</h3>
      <p>You can delete your account any time from Profile &rarr; Danger Zone &rarr; Delete My Account. This removes your profile, contacts, encrypted keys, chats, messages, statuses, push tokens, support tickets, and your authentication record. Some operational logs and backups may persist for a short period for security and legal reasons. For any data-protection request, contact the Grievance Officer at <strong>Labhansh.garg@outlook.com</strong>.</p>

      <h3 className="text-base font-semibold mt-4">E. Third-Party Processors</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li>Supabase (managed backend, authentication, database, file storage, realtime).</li>
        <li>Web Push providers (browser push notification delivery, when you opt in).</li>
        <li>Hosting/CDN providers for serving the web app.</li>
      </ul>

      <h3 className="text-base font-semibold mt-4">F. Permissions</h3>
      <p>VibTribe asks for the following device permissions. Each one is requested only when you first use the related feature. In the installed Android app you can review and re-request them from <strong>Profile &rarr; Privacy &rarr; Permissions</strong>. In the browser/PWA version, permissions are managed from your browser's site-settings page (or Android <em>Settings &rarr; Apps &rarr; VibTribe &rarr; Permissions</em>).</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Camera</strong> — to capture photos and to send video during video calls.</li>
        <li><strong>Microphone</strong> — to record voice notes and to transmit audio during voice and video calls.</li>
        <li><strong>Contacts</strong> — opens a system contact picker so you can choose a single contact's name/number to add as a friend. We do not read or upload your full address book.</li>
        <li><strong>Notifications</strong> — to alert you of new messages, incoming calls, and status interactions.</li>
        <li><strong>Photos &amp; Gallery</strong> — to let you attach images and videos from your device to chats and status updates. Files are only accessed when you explicitly pick them.</li>
        <li><strong>Storage</strong> — to cache your chat list, encrypted message history, and recently viewed media on-device so the app works offline and loads quickly.</li>
      </ul>
      <p className="text-xs text-muted-foreground">Denying a permission disables only the related feature; the rest of the app continues to work. We never request location, SMS, phone-call, or background-microphone permissions.</p>

      <h3 className="text-base font-semibold mt-4">G. Children</h3>
      <p>The App is strictly for users aged 18 and above. We do not knowingly collect data from anyone under 18. If we learn that we have collected data from a user under 18, we will delete that account and associated data promptly.</p>

      <h3 className="text-base font-semibold mt-4">H. Your Rights</h3>
      <p>Subject to applicable law (including India's Digital Personal Data Protection Act, 2023) you may request access, correction, or deletion of your personal data, and may withdraw consent. Contact the Grievance Officer at <strong>Labhansh.garg@outlook.com</strong>.</p>
    </div>
  );
}
