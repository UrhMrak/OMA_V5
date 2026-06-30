import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function About() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <div className="row-gap">
      <div>
        <h2 className="h2">About</h2>
        <p className="muted">
          Orchestra Manager helps you plan rehearsals, manage your music library,
          and keep your ensemble in sync.
        </p>
      </div>

      <section id="help" className="card">
        <h3 className="h3">Help &amp; Support</h3>
        <p className="muted small">
          Need a hand? We&apos;re here to help you get the most out of Orchestra
          Manager.
        </p>
        <p className="muted small">
          Browse common questions below, or reach out to our team and we&apos;ll
          get back to you as soon as we can.
        </p>
        <ul className="muted small">
          <li>
            <strong>Getting started:</strong> Use the Calendar to schedule
            rehearsals and concerts, and the Music Library to organize your
            scores and parts.
          </li>
          <li>
            <strong>Managing events:</strong> Click any date to add or edit an
            event. Members can view upcoming activities from the dashboard.
          </li>
          <li>
            <strong>Account &amp; access:</strong> Contact your administrator if
            you have trouble signing in or need updated permissions.
          </li>
        </ul>
        <p className="muted small">
          Still stuck? Email us at{' '}
          <a href="mailto:mrak.webstudios@gmail.com">mrak.webstudios@gmail.com</a>{' '}
          and we&apos;ll be happy to assist.
        </p>
      </section>

      <section id="privacy" className="card">
        <h3 className="h3">Privacy Policy</h3>
        <p className="muted small">
          Your privacy is important to us. This Privacy Policy explains how
          Orchestra Manager collects, uses, and protects your information when you
          use our service.
        </p>
        <p className="muted small">
          <strong>Information we collect.</strong> We collect information you
          provide directly, such as your name, email address, and any content you
          add to the platform (events, files, and notes). We also collect basic
          usage data to help us improve the service.
        </p>
        <p className="muted small">
          <strong>How we use information.</strong> We use your information to
          operate and maintain the service, communicate with you, and improve your
          experience. We do not sell your personal information to third parties.
        </p>
        <p className="muted small">
          <strong>Data storage and security.</strong> We take reasonable measures
          to protect your data against unauthorized access, alteration, or
          disclosure. However, no method of transmission or storage is completely
          secure.
        </p>
        <p className="muted small">
          <strong>Your rights.</strong> You may request access to, correction of,
          or deletion of your personal information at any time by contacting us.
        </p>
        <p className="muted small">
          If you have any questions about this Privacy Policy, please contact us at{' '}
          <a href="mailto:mrak.webstudios@gmail.com">mrak.webstudios@gmail.com</a>.
        </p>
      </section>

      <section id="terms" className="card">
        <h3 className="h3">Terms of Service</h3>
        <p className="muted small">
          By accessing or using Orchestra Manager, you agree to be bound by these
          Terms of Service. Please read them carefully.
        </p>
        <p className="muted small">
          <strong>Use of the service.</strong> You agree to use the service only
          for lawful purposes and in accordance with these terms. You are
          responsible for maintaining the confidentiality of your account
          credentials and for all activity under your account.
        </p>
        <p className="muted small">
          <strong>Content.</strong> You retain ownership of the content you upload,
          but grant us the rights necessary to host and display it within the
          service. You are responsible for ensuring you have the rights to any
          content you share.
        </p>
        <p className="muted small">
          <strong>Availability.</strong> We strive to keep the service available
          but do not guarantee uninterrupted access. We may modify, suspend, or
          discontinue features at any time.
        </p>
        <p className="muted small">
          <strong>Limitation of liability.</strong> The service is provided
          &quot;as is&quot; without warranties of any kind. To the fullest extent
          permitted by law, we are not liable for any damages arising from your use
          of the service.
        </p>
        <p className="muted small">
          <strong>Changes to these terms.</strong> We may update these Terms of
          Service from time to time. Continued use of the service after changes
          take effect constitutes acceptance of the revised terms.
        </p>
      </section>
    </div>
  );
}
