import { Link } from 'react-router-dom';
import { ArrowLeft, GitBranch } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8FBCFA] via-[#FF9A9D] to-[#F6D785] flex items-center justify-center">
              <GitBranch size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Visual Codebase</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Privacy Policy
          </h1>
          <p className="text-gray-500 mb-8">Last updated: January 2025</p>

          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-600 mb-4">
                Visual Codebase ("we," "our," or "us") is committed to protecting your privacy.
                This Privacy Policy explains how we collect, use, disclose, and safeguard your
                information when you use our codebase visualization service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>

              <h3 className="text-lg font-medium text-gray-800 mb-3">2.1 Account Information</h3>
              <p className="text-gray-600 mb-4">When you create an account, we collect:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                <li>Email address</li>
                <li>Name (if provided)</li>
                <li>Profile information from OAuth providers (GitHub, Google)</li>
                <li>Authentication tokens for third-party services</li>
              </ul>

              <h3 className="text-lg font-medium text-gray-800 mb-3">2.2 Code and Analysis Data</h3>
              <p className="text-gray-600 mb-4">When you use our service, we process:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                <li>Source code files you submit for analysis</li>
                <li>Repository metadata (file names, paths, structure)</li>
                <li>Analysis results (dependency graphs, file categorizations)</li>
                <li>GitHub repository information (for connected repositories)</li>
              </ul>

              <h3 className="text-lg font-medium text-gray-800 mb-3">2.3 Usage Data</h3>
              <p className="text-gray-600 mb-4">We automatically collect:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                <li>Browser type and version</li>
                <li>Operating system</li>
                <li>Pages visited and features used</li>
                <li>Time and date of visits</li>
                <li>IP address (anonymized where possible)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-600 mb-4">We use collected information to:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                <li>Provide and maintain the Service</li>
                <li>Process and analyze your code to generate visualizations</li>
                <li>Store your analysis history and saved projects</li>
                <li>Authenticate you and manage your account</li>
                <li>Communicate with you about the Service</li>
                <li>Improve and optimize the Service</li>
                <li>Detect and prevent fraud or abuse</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">4. AI Processing</h2>
              <p className="text-gray-600 mb-4">
                Our Service uses AI (powered by Anthropic's Claude) to analyze and categorize code:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                <li>Code snippets are sent to AI services for analysis</li>
                <li>We only send the minimum information necessary for analysis</li>
                <li>AI providers process data according to their privacy policies</li>
                <li>We do not use your code to train AI models</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Data Storage and Security</h2>
              <p className="text-gray-600 mb-4">We implement security measures including:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                <li>Encryption of data in transit (TLS/SSL)</li>
                <li>Encryption of sensitive data at rest</li>
                <li>Secure authentication mechanisms</li>
                <li>Regular security assessments</li>
                <li>Access controls and audit logging</li>
              </ul>
              <p className="text-gray-600 mb-4">
                Data is stored using Supabase's cloud infrastructure with industry-standard
                security practices.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Data Sharing</h2>
              <p className="text-gray-600 mb-4">We may share your information with:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                <li>
                  <strong>Service Providers:</strong> Third parties that help us operate the Service
                  (hosting, analytics, AI processing)
                </li>
                <li>
                  <strong>Legal Requirements:</strong> When required by law or to protect our rights
                </li>
                <li>
                  <strong>Business Transfers:</strong> In connection with a merger, acquisition, or
                  sale of assets
                </li>
              </ul>
              <p className="text-gray-600 mb-4">
                We do not sell your personal information to third parties.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Your Rights and Choices</h2>
              <p className="text-gray-600 mb-4">You have the right to:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                <li>
                  <strong>Access:</strong> Request a copy of your personal data
                </li>
                <li>
                  <strong>Correction:</strong> Update or correct inaccurate information
                </li>
                <li>
                  <strong>Deletion:</strong> Request deletion of your account and data
                </li>
                <li>
                  <strong>Export:</strong> Download your data in a portable format
                </li>
                <li>
                  <strong>Opt-out:</strong> Unsubscribe from marketing communications
                </li>
                <li>
                  <strong>Revoke Access:</strong> Disconnect third-party integrations
                </li>
              </ul>
              <p className="text-gray-600 mb-4">
                You can exercise these rights through your account settings or by contacting us.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Data Retention</h2>
              <p className="text-gray-600 mb-4">We retain your data as follows:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                <li>
                  <strong>Account Data:</strong> Retained while your account is active
                </li>
                <li>
                  <strong>Analysis Results:</strong> Retained until you delete them or your account
                </li>
                <li>
                  <strong>Deleted Accounts:</strong> Data is purged within 30 days of account deletion
                </li>
                <li>
                  <strong>Logs:</strong> Retained for up to 90 days for security purposes
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Cookies and Tracking</h2>
              <p className="text-gray-600 mb-4">We use cookies and similar technologies to:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                <li>Maintain your session and authentication state</li>
                <li>Remember your preferences</li>
                <li>Analyze usage patterns to improve the Service</li>
              </ul>
              <p className="text-gray-600 mb-4">
                You can control cookies through your browser settings, but some features may not
                work properly without them.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Children's Privacy</h2>
              <p className="text-gray-600 mb-4">
                The Service is not intended for children under 13 years of age. We do not knowingly
                collect personal information from children. If you believe we have collected
                information from a child, please contact us.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">11. International Data Transfers</h2>
              <p className="text-gray-600 mb-4">
                Your information may be transferred to and processed in countries other than your
                own. We ensure appropriate safeguards are in place to protect your data in accordance
                with this Privacy Policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">12. Changes to This Policy</h2>
              <p className="text-gray-600 mb-4">
                We may update this Privacy Policy from time to time. We will notify you of material
                changes by posting the new policy on this page and updating the "Last updated" date.
                Your continued use of the Service after changes constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">13. Contact Us</h2>
              <p className="text-gray-600 mb-4">
                If you have questions about this Privacy Policy or our data practices, contact us at:
              </p>
              <p className="text-gray-600 mb-2">
                <strong>Email:</strong>{' '}
                <a
                  href="mailto:privacy@visualcodebase.com"
                  className="text-[#8FBCFA] hover:underline"
                >
                  privacy@visualcodebase.com
                </a>
              </p>
              <p className="text-gray-600">
                <strong>Data Protection Inquiries:</strong>{' '}
                <a
                  href="mailto:dpo@visualcodebase.com"
                  className="text-[#8FBCFA] hover:underline"
                >
                  dpo@visualcodebase.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="border-t border-gray-200 py-6">
        <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Visual Codebase. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/terms" className="text-sm text-gray-600 hover:text-gray-900">
              Terms of Service
            </Link>
            <Link to="/privacy" className="text-sm text-gray-600 hover:text-gray-900">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
