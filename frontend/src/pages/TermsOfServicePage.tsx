import { Link } from 'react-router-dom';
import { ArrowLeft, GitBranch } from 'lucide-react';

export default function TermsOfServicePage() {
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
            Terms of Service
          </h1>
          <p className="text-gray-500 mb-8">Last updated: January 2025</p>

          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-600 mb-4">
                By accessing or using Visual Codebase ("the Service"), you agree to be bound by these
                Terms of Service. If you do not agree to these terms, please do not use the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
              <p className="text-gray-600 mb-4">
                Visual Codebase is an AI-powered codebase visualization tool that:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                <li>Analyzes source code repositories to extract structural information</li>
                <li>Generates interactive dependency graphs and visualizations</li>
                <li>Categorizes files by their architectural role using AI</li>
                <li>Provides insights into code organization and dependencies</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">3. User Accounts</h2>
              <p className="text-gray-600 mb-4">
                To access certain features of the Service, you may be required to create an account.
                You are responsible for:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized use of your account</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Acceptable Use</h2>
              <p className="text-gray-600 mb-4">You agree not to:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                <li>Use the Service for any unlawful purpose or in violation of any applicable laws</li>
                <li>Upload or analyze code that you do not have the right to access or share</li>
                <li>Attempt to interfere with or disrupt the Service or its servers</li>
                <li>Attempt to gain unauthorized access to any part of the Service</li>
                <li>Use the Service to transmit malware or other harmful code</li>
                <li>Scrape, crawl, or use automated means to access the Service without permission</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Code and Data</h2>
              <p className="text-gray-600 mb-4">
                When you use the Service to analyze code:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                <li>You retain all ownership rights to your code</li>
                <li>You grant us a limited license to process your code solely for providing the Service</li>
                <li>We do not claim ownership of any code you analyze</li>
                <li>Analysis results may be stored to provide you with history and saved analyses</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">6. GitHub Integration</h2>
              <p className="text-gray-600 mb-4">
                If you connect your GitHub account:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                <li>You authorize us to access repositories you explicitly select for analysis</li>
                <li>We only access repositories with your explicit permission</li>
                <li>You may revoke access at any time through your GitHub settings</li>
                <li>We comply with GitHub's terms of service and API usage policies</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Intellectual Property</h2>
              <p className="text-gray-600 mb-4">
                The Service, including its original content, features, and functionality, is owned by
                Visual Codebase and is protected by international copyright, trademark, and other
                intellectual property laws.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Disclaimer of Warranties</h2>
              <p className="text-gray-600 mb-4">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
                EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
                ERROR-FREE, OR COMPLETELY SECURE.
              </p>
              <p className="text-gray-600 mb-4">
                AI-generated analysis and categorization may not be 100% accurate. You should verify
                important results independently.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Limitation of Liability</h2>
              <p className="text-gray-600 mb-4">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, VISUAL CODEBASE SHALL NOT BE LIABLE FOR ANY
                INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF
                PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Account Termination</h2>
              <p className="text-gray-600 mb-4">
                We reserve the right to suspend or terminate your account at any time for violations
                of these Terms. You may also delete your account at any time through your account
                settings. Upon deletion, your data will be removed according to our Privacy Policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">11. Changes to Terms</h2>
              <p className="text-gray-600 mb-4">
                We may modify these Terms at any time. We will notify users of material changes by
                posting the new Terms on this page and updating the "Last updated" date. Your
                continued use of the Service after changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">12. Governing Law</h2>
              <p className="text-gray-600 mb-4">
                These Terms shall be governed by and construed in accordance with the laws of the
                United States, without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">13. Contact Us</h2>
              <p className="text-gray-600 mb-4">
                If you have any questions about these Terms, please contact us at:
              </p>
              <p className="text-gray-600">
                <a
                  href="mailto:legal@visualcodebase.com"
                  className="text-[#8FBCFA] hover:underline"
                >
                  legal@visualcodebase.com
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
