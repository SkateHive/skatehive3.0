"use client";

import { useMemo, useState } from "react";
import { buildMagicLinkEmail } from "@/lib/email/magicLinkTemplate";
import { buildMissYouEmail } from "@/lib/email/missYouTemplate";
import { buildWelcomeEmail } from "@/lib/email/welcomeTemplate";
import { buildInviteKeysBackup } from "@/lib/invite/backup";
import getMailTemplate_Invite from "@/lib/invite/template";

const SAMPLE_KEYS = {
  owner: "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3",
  ownerPubkey: "STM5jYVokmZHdEpwo5oCG3ES2Ca4VYzy6tM8pWWkGdgVnwo2mFLFq",
  active: "5JdeC9P7Pbd1uGdFVEsJ41EkEnADbbHGq6p1BwFxm6txNBsQnsw",
  activePubkey: "STM6vJmrwaX5TjgTS9dPH8KsArso5m91fVodJvv91j7G765wqcNM9",
  posting: "5Hr2vh1Tjk2QkUjBkmJrFV8YPCQ8mEhqJDquYqLg5zBKkLp4ZcA",
  postingPubkey: "STM5jzpZJ4mLpD7v5DFFEAsm1axQrxBQCYwGfP4qDc7P9XGZ4VygH",
  memo: "5KQVTwhx9KMmaQHHy7VrJrgkFnRcL1bX7uztsK4hSZeYG3pYpDF",
  memoPubkey: "STM8RvBHRZFmZc6h3oW2ApEqfQ8WAEUYrLh4qwGGdaCo9rNGCbKkY",
};

const LANGUAGES = [
  { code: "EN", label: "English" },
  { code: "PT-BR", label: "Português (Brasil)" },
  { code: "ES", label: "Español" },
];

export default function EmailRevampPage() {
  const [loginUrl, setLoginUrl] = useState(
    "http://localhost:3000/api/userbase/auth/magic-link?token=3c7de5b6d65ad60ba277ad3892f2b40f0711eb2a3c00496cf50e7b19addfc443"
  );
  const [createdby, setCreatedby] = useState("xvlad");
  const [desiredUsername, setDesiredUsername] = useState("newskater");
  const [masterPassword, setMasterPassword] = useState(
    "SKATE000P5K2hYwK9oF8u3Mq"
  );
  const [language, setLanguage] = useState("EN");

  const magic = useMemo(() => buildMagicLinkEmail(loginUrl), [loginUrl]);

  const welcome = useMemo(
    () => buildWelcomeEmail({ handle: desiredUsername, displayName: null }),
    [desiredUsername]
  );

  const inviteHtml = useMemo(
    () =>
      getMailTemplate_Invite(
        createdby,
        desiredUsername,
        masterPassword,
        SAMPLE_KEYS,
        language
      ),
    [createdby, desiredUsername, masterPassword, language]
  );

  const missYou = useMemo(
    () => buildMissYouEmail({ handle: desiredUsername, displayName: null }),
    [desiredUsername]
  );

  const inviteBackup = useMemo(
    () =>
      buildInviteKeysBackup({
        createdby,
        desiredUsername,
        masterPassword,
        keys: SAMPLE_KEYS,
        createdAt: "2026-05-25T01:04:00.000Z",
      }),
    [createdby, desiredUsername, masterPassword]
  );

  const inviteSubject = `Welcome to Skatehive @${desiredUsername}`;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Email Revamp</h1>
        <p style={styles.subtitle}>
          Live preview of authentication + sponsorship emails. Edit the
          template files and refresh to iterate.
        </p>
      </header>

      <section style={styles.controls}>
        <Field label="Login URL (magic link)">
          <input
            type="text"
            value={loginUrl}
            onChange={(e) => setLoginUrl(e.target.value)}
            style={styles.input}
          />
        </Field>
        <Field label="Sponsor (createdby)">
          <input
            type="text"
            value={createdby}
            onChange={(e) => setCreatedby(e.target.value)}
            style={styles.input}
          />
        </Field>
        <Field label="New username">
          <input
            type="text"
            value={desiredUsername}
            onChange={(e) => setDesiredUsername(e.target.value)}
            style={styles.input}
          />
        </Field>
        <Field label="Master password">
          <input
            type="text"
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            style={styles.input}
          />
        </Field>
        <Field label="Language (invite)">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={styles.input}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section style={styles.grid}>
        <EmailPreview
          title="1. Magic-link sign-in"
          subject={magic.subject}
          html={magic.html}
          text={magic.text}
          file={null}
        />
        <EmailPreview
          title="3. New account welcome (email sign-up)"
          subject={welcome.subject}
          html={welcome.html}
          text={welcome.text}
          file={null}
        />
        <EmailPreview
          title="4. We miss you (winback)"
          subject={missYou.subject}
          html={missYou.html}
          text={missYou.text}
          file={null}
        />
        <EmailPreview
          title="2. Sponsored account welcome"
          subject={inviteSubject}
          html={inviteHtml}
          text={null}
          file={{
            name: `KEYS-BACKUP-${desiredUsername}-SKATEHIVE.TXT`,
            content: inviteBackup,
          }}
        />
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function EmailPreview({
  title,
  subject,
  html,
  text,
  file,
}: {
  title: string;
  subject: string;
  html: string;
  text: string | null;
  file: { name: string; content: string } | null;
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>{title}</h2>
        <div style={styles.subjectRow}>
          <span style={styles.subjectLabel}>Subject</span>
          <span style={styles.subjectValue}>{subject}</span>
        </div>
      </div>
      <iframe
        title={title}
        srcDoc={html}
        style={styles.iframe}
        sandbox=""
      />
      {text && (
        <details style={styles.details}>
          <summary style={styles.summary}>Plain-text fallback</summary>
          <pre style={styles.pre}>{text}</pre>
        </details>
      )}
      {file && (
        <details style={styles.details} open>
          <summary style={styles.summary}>Attachment · {file.name}</summary>
          <pre style={styles.pre}>{file.content}</pre>
        </details>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#e0e0e0",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    padding: "32px 24px 64px",
  },
  header: {
    maxWidth: 1400,
    margin: "0 auto 24px",
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    color: "#4caf50",
    letterSpacing: 0.5,
  },
  subtitle: {
    margin: "8px 0 0",
    fontSize: 14,
    color: "#888",
  },
  controls: {
    maxWidth: 1400,
    margin: "0 auto 24px",
    background: "#121212",
    border: "1px solid #1f1f1f",
    borderRadius: 12,
    padding: 20,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 13,
  },
  fieldLabel: {
    color: "#aaa",
    fontWeight: 600,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    fontSize: 11,
  },
  input: {
    background: "#0a0a0a",
    color: "#e0e0e0",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    outline: "none",
  },
  grid: {
    maxWidth: 1400,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(520px, 1fr))",
    gap: 24,
  },
  card: {
    background: "#121212",
    border: "1px solid #1f1f1f",
    borderRadius: 12,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  cardHeader: {
    padding: "16px 20px",
    borderBottom: "1px solid #1f1f1f",
  },
  cardTitle: {
    margin: "0 0 8px",
    fontSize: 16,
    color: "#fff",
  },
  subjectRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    fontSize: 13,
  },
  subjectLabel: {
    color: "#888",
    fontWeight: 600,
    letterSpacing: 0.3,
    fontSize: 11,
    textTransform: "uppercase",
  },
  subjectValue: {
    color: "#e0e0e0",
  },
  iframe: {
    width: "100%",
    height: 760,
    border: "none",
    background: "#fff",
  },
  details: {
    borderTop: "1px solid #1f1f1f",
    padding: "12px 20px",
  },
  summary: {
    cursor: "pointer",
    color: "#4caf50",
    fontSize: 13,
    fontWeight: 600,
    listStyle: "none",
  },
  pre: {
    margin: "12px 0 0",
    padding: 14,
    background: "#0a0a0a",
    border: "1px solid #1f1f1f",
    borderRadius: 8,
    fontSize: 12,
    lineHeight: 1.5,
    color: "#cfcfcf",
    overflowX: "auto",
    whiteSpace: "pre",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
};
