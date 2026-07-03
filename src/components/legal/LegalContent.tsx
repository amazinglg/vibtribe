import { Link } from '@tanstack/react-router';

/**
 * Legal content for VibTribe. Exposed as three components:
 *   - <TermsConditionsContent />  → Terms of Service only (no Privacy).
 *   - <PrivacyPolicyContent />    → Privacy Policy only.
 *   - <TermsContent />            → both, used by the in-app acceptance modal.
 * The split lets us expose them on dedicated /terms and /privacy pages and
 * record separate acceptance timestamps for each.
 */
export function TermsConditionsContent() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
      <p className="text-muted-foreground">Last updated: 18 June 2026</p>

      <h2 className="text-lg font-semibold mt-6">1. Acceptance of Terms</h2>
      <p>By creating an account or using VibTribe ("the App", "we", "us", "our"), you agree to these Terms &amp; Conditions. Use of the App is also governed by our <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>, which is a separate document. If you do not agree with either, you must not use the App.</p>

      <h2 className="text-lg font-semibold mt-6">2. Eligibility &amp; Age</h2>
      <p>VibTribe applies a strict age policy:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Under 13:</strong> sign-up is <strong>blocked</strong>. You must not create or use an account. Any account discovered to belong to a user under 13 will be terminated and the associated data deleted.</li>
        <li><strong>13 to 17 (inclusive):</strong> you may sign up, but the account remains restricted until your parent or legal guardian completes verifiable consent via the guardian consent flow, as required by §9 of India\u2019s Digital Personal Data Protection Act, 2023. Your guardian may withdraw consent at any time, which will restrict your account.</li>
        <li><strong>18 and above:</strong> you may sign up and use the app directly.</li>
      </ul>
      <p>By signing up you confirm that the information you provide (including your date of birth) is accurate and that you are legally permitted to use the service. When you turn 18, the guardian consent flow is automatically retired and any minor-related restrictions are lifted; the historical consent record is retained for audit purposes.</p>

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

      <h2 className="text-lg font-semibold mt-6">5a. Email Address</h2>
      <p>An email address is <strong>mandatory</strong> at signup. We use it solely to (a) verify your identity with a 6-digit one-time code, (b) recover your password, (c) send account, support, and ticket-related communications, and (d) send service notifications you have not opted out of. Your email address is visible only to you, our administrators, and the master admin — it is never shown to other users. You can opt out of non-essential emails at any time from Profile &rarr; Notifications. Security and authentication emails (OTP codes, password resets) will continue to be sent regardless of opt-out status.</p>
      <p>If you have explicitly opted in, we may also send <strong>promotional emails</strong> (product updates, tips, and announcements) from <code>promotions@news.vibtribe.in</code>. Every promotional email includes a one-click unsubscribe link that takes effect immediately, and you can also toggle the preference from Profile &rarr; Notifications. Withdrawing consent does not affect security or transactional emails.</p>

      <h2 className="text-lg font-semibold mt-6">5b. Status Feature (Stories)</h2>
      <p><strong>Statuses are not end-to-end encrypted.</strong> The Status feature is designed for short-lived sharing (similar to WhatsApp and Instagram Stories) and the underlying photo/video file is stored on a public URL so the people you choose to share with can load it quickly. Anyone who obtains the URL during the 24-hour window can view the media, regardless of who is in your selected audience. Do not post anything truly confidential to your status.</p>
      <p><strong>24-hour auto-deletion.</strong> Every status — including any uploaded photo, video, caption and visibility list — is automatically and permanently deleted from our servers <strong>24 hours after it is posted</strong>. After deletion the file is unrecoverable and cannot be restored, even by us. You can also delete any status manually at any time before the 24-hour window expires.</p>

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
    </div>
  );
}

export function PrivacyPolicyContent() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
      <p className="text-muted-foreground">Last updated: 18 June 2026</p>
      <p>VibTribe is a privacy-first messaging app. This Privacy Policy explains exactly what data we collect when you sign up and use the service, how we use it, who can see it, and the choices you have. It is a separate document from our <Link to="/terms" className="text-primary underline">Terms &amp; Conditions</Link>, although both must be accepted to use the App.</p>

      <h3 className="text-base font-semibold mt-6">A. Information We Collect About You</h3>
      <p>The following list is exhaustive — these are every field we store about a user account in our database:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Full name</strong> — required at signup; shown to other users you chat with.</li>
        <li><strong>Date of birth</strong> — required at signup, used to enforce our age policy: sign-up is blocked under 13; users aged 13–17 must complete verifiable guardian consent; users 18+ sign up directly. Kept <strong>strictly confidential</strong>: visible only to you and our authorised admin team; never shown to other users.</li>
        <li><strong>Mobile number &amp; country code</strong> — required at signup; serves as your unique identifier and is visible to other users so they can add you as a contact.</li>
        <li><strong>Email address</strong> — required at signup. Used for OTP verification, password recovery, support replies, and (only if you opted in) promotional emails. Your email is visible only to you and our admins, never to other users.</li>
        <li><strong>Password</strong> — stored only as a salted bcrypt hash. We never see or store your plaintext password.</li>
        <li><strong>Username</strong> (optional) — a public handle other users can find you by.</li>
        <li><strong>Profile photo / avatar</strong> (optional) — visible according to your Profile photo visibility setting (All / Contacts / Nobody).</li>
        <li><strong>Short bio</strong> (optional).</li>
        <li><strong>App preferences</strong> — selected theme, notification toggles, language, and per-feature permissions you have granted (microphone, camera, contacts, notifications).</li>
        <li><strong>Two-factor authentication state</strong> — whether 2FA is enabled, and if so, the encrypted TOTP secret (readable only by you, never to other users).</li>
        <li><strong>Encryption material</strong> — your ECDH public key (used by others to send you encrypted messages) and your private key, wrapped/encrypted with a key derived on your device from your 6-digit PIN. We never store your PIN or the unwrapped private key.</li>
        <li><strong>Chat messages &amp; media (1-to-1)</strong> — encrypted on your device before upload; we store only the ciphertext plus routing metadata (chat id, sender id, timestamp, delivery/read status, expiry).</li>
        <li><strong>Group / tribe messages</strong> — stored on our servers in plaintext to enable group features; protected in transit (HTTPS) and at rest by access controls. <em>Not</em> end-to-end encrypted today.</li>
        <li><strong>Status updates (stories)</strong> — caption, media file URL, visibility audience and views. Automatically and permanently deleted 24 hours after posting.</li>
        <li><strong>Contacts</strong> — only the contact entries you create inside the App. We do not upload or read your phone's address book.</li>
        <li><strong>Blocked users</strong> — the list of accounts you have blocked.</li>
        <li><strong>Calls metadata</strong> — caller, callee, start/end timestamps, missed/answered status. Call audio/video is peer-to-peer (WebRTC) and is not recorded.</li>
        <li><strong>Presence &amp; technical data</strong> — last-seen timestamp, online status, device push-subscription tokens (web push and Firebase Cloud Messaging tokens for Android).</li>
        <li><strong>Support tickets</strong> — name, email, issue title and body, attachments and reply thread that you submit through the in-app help form.</li>
        <li><strong>Login &amp; session security</strong> — count of failed login attempts, account status (active / suspended / blocked), active session records, OTP rate-limit records.</li>
        <li><strong>Consent records</strong> — timestamps for when you accepted these Terms, when you accepted this Privacy Policy, and when you opted in (or out of) promotional emails. For the marketing choice we also record the IP address and the screen the choice was made on (signup form, re-consent prompt, or profile settings) for compliance audit purposes (DPDP Act 2023, GDPR, CAN-SPAM).</li>
        <li><strong>Role flags</strong> — whether your account is a standard user, admin, or master admin; whether you carry the blue Verified badge.</li>
      </ul>

      <h3 className="text-base font-semibold mt-6">B. What We Do <em>Not</em> Collect</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li>We do not read or sell the contents of your end-to-end encrypted 1:1 messages or media.</li>
        <li>We do not expose your date of birth, email address, or two-factor secret to other users.</li>
        <li>We do not upload your phone's contact list.</li>
        <li>We do not record your voice or video calls.</li>
        <li>We do not track your precise GPS location.</li>
        <li>We do not run third-party advertising or behavioural-profiling trackers.</li>
      </ul>

      <h3 className="text-base font-semibold mt-6">C. How We Use Your Data</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li>To operate the messaging, calling, status and group features you use.</li>
        <li>To verify your identity at signup and during password resets (email OTP).</li>
        <li>To enforce safety, prevent abuse, and respond to lawful requests from authorised Indian agencies.</li>
        <li>To respond to support tickets you submit.</li>
        <li>To send service notifications (delivery, security alerts) and, only with your explicit opt-in, promotional emails.</li>
      </ul>

      <h3 className="text-base font-semibold mt-6">D. Encryption Approach</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li>Key exchange: ECDH on the NIST P-256 curve via the Web Crypto API.</li>
        <li>Message &amp; media encryption: AES-GCM-256 with a fresh random IV per payload.</li>
        <li>Private-key protection: your private key is wrapped with an AES-GCM key derived from your 6-digit PIN using PBKDF2-SHA256 (100,000 iterations) before being stored on our servers.</li>
        <li>If you forget your PIN, encrypted chat history cannot be recovered.</li>
      </ul>

      <h3 className="text-base font-semibold mt-6">E. Account Deletion &amp; Retention</h3>
      <p>You can delete your account any time from Profile &rarr; Danger Zone &rarr; Delete My Account. This removes your profile, contacts, encrypted keys, chats, messages, statuses, push tokens, support tickets, and your authentication record. Some operational logs and backups may persist for a short period for security and legal reasons. Status media is auto-deleted 24 hours after posting regardless of account state. For any data-protection request, contact the Grievance Officer at <strong>Labhansh.garg@outlook.com</strong>.</p>

      <h3 className="text-base font-semibold mt-6">F. Third-Party Processors</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li>Supabase (managed backend: authentication, database, file storage, realtime).</li>
        <li>Cloudflare (hosting, CDN, edge runtime serving the web and API).</li>
        <li>Resend (transactional and marketing email delivery).</li>
        <li>Firebase Cloud Messaging and Web Push providers (notification delivery, when you opt in).</li>
      </ul>

      <h3 className="text-base font-semibold mt-6">G. Device Permissions We May Request</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li>Camera &amp; microphone — for sending photos, voice notes, and voice/video calls.</li>
        <li>Notifications — to alert you of new messages and calls.</li>
        <li>Storage / file access — to attach files you choose.</li>
      </ul>

      <h3 className="text-base font-semibold mt-6">H. Children &amp; Guardian Consent</h3>
      <p>Sign-up is <strong>blocked for anyone under 13</strong>. We do not knowingly collect data from anyone under 13; if we learn that we have, we will delete the account and associated data promptly.</p>
      <p>Users aged <strong>13 to 17</strong> may sign up, but the account is restricted to the guardian setup flow (<code>/guardian-setup</code>) until a parent or legal guardian:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>receives a one-time verification code by email;</li>
        <li>reviews the consent request page (linked from the email) and explicitly ticks the confirmation box; and</li>
        <li>submits verifiable consent under §9 of India\u2019s Digital Personal Data Protection Act, 2023.</li>
      </ul>
      <p>Until consent is recorded the minor cannot chat, call, share media, or use age-restricted features. The guardian can withdraw consent at any time from the same link, which immediately restricts the minor\u2019s account. We send the guardian a monthly reminder email while the account is active.</p>
      <p>When the user turns 18, the guardian consent flow is <strong>automatically retired</strong>, monthly reminders stop, and all minor-related restrictions are lifted. The historical consent record is retained for compliance audit purposes.</p>
      <p>Users aged <strong>18 and above</strong> may sign up and use the app directly.</p>

      <h3 className="text-base font-semibold mt-6">I. Your Rights</h3>
      <p>Subject to applicable law (including India's Digital Personal Data Protection Act, 2023, and the EU/UK GDPR where applicable) you may request access, correction, export, or deletion of your personal data, and may withdraw consent at any time. Contact the Grievance Officer at <strong>Labhansh.garg@outlook.com</strong>.</p>

      <h3 className="text-base font-semibold mt-6">J. Marketing Emails</h3>
      <p>We send promotional emails (product updates, tips, and announcements) only to users who have <strong>explicitly opted in</strong>. We record the timestamp, source (signup form, re-consent prompt, or profile settings), and IP address of your consent for compliance audit purposes.</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Legal basis:</strong> your explicit consent — DPDP Act 2023 § 6 (India), GDPR Art. 6(1)(a) (EU/EEA), and CAN-SPAM Act compliance (US).</li>
        <li><strong>Sender:</strong> VibTribe &lt;promotions@news.vibtribe.in&gt;. Reply-to: Labhansh.garg@outlook.com.</li>
        <li><strong>Withdrawal:</strong> click the unsubscribe link in any promotional email (no login required, takes effect immediately) or toggle off in Profile &rarr; Notifications.</li>
        <li><strong>Suppression:</strong> hard bounces and spam complaints are automatically suppressed and the user is opted out across the platform.</li>
        <li><strong>Right to complain:</strong> you may lodge a complaint with India's Data Protection Board or your local EU data-protection authority.</li>
      </ul>
      <p>Transactional and security emails (OTP codes, password resets, ticket replies, account notices) are <em>not</em> covered by this consent and will continue regardless.</p>

      <h3 className="text-base font-semibold mt-6">K. Contact</h3>
      <p>For any privacy question or request, email the Grievance Officer at <strong>Labhansh.garg@outlook.com</strong>. We acknowledge within 24 hours and resolve within 15 days as required by the IT Rules, 2021.</p>
    </div>
  );
}

/** Combined view (Terms followed by Privacy) used inside the in-app acceptance modal. */
export function TermsContent() {
  return (
    <div>
      <TermsConditionsContent />
      <div className="my-8 border-t border-border" />
      <h2 className="text-xl font-bold mb-2">Privacy Policy</h2>
      <PrivacyPolicyContent />
    </div>
  );
}
