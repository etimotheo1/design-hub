// Email delivery via Resend. Activates only when both env vars are set:
//
//   RESEND_API_KEY  — get from https://resend.com (free 100/day)
//   EMAIL_FROM      — e.g. "Design Hub <noreply@neldi.com>" (DNS-verified)
//                     or "Design Hub <onboarding@resend.dev>" (default sender)
//
// Optional:
//   APP_BASE_URL    — base URL used in invite links (defaults to the request host).
//
// If RESEND_API_KEY is not set, `sendInvitationEmail` returns silently and the
// system falls back to its link-only flow (admin copies the URL manually).
//
// We use direct fetch instead of adding the `resend` npm package — fewer
// dependencies, identical behaviour.

export interface InvitationEmailInput {
  to: string;
  displayName: string;
  inviteUrl: string;
  invitedByName: string;
  expiresAt: string;
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export async function sendInvitationEmail(input: InvitationEmailInput): Promise<{ ok: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    return { ok: false, error: "Email not configured" };
  }

  const subject = `${input.invitedByName} invited you to Design Hub`;
  const html = renderInvitationHtml(input);
  const text = renderInvitationText(input);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [input.to],
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email send failed" };
  }
}

function renderInvitationHtml(input: InvitationEmailInput): string {
  const expires = new Date(input.expiresAt).toLocaleDateString();
  return `
<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
      <div style="display:inline-block;height:32px;width:32px;border-radius:8px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 60%,#06b6d4 100%);color:#fff;text-align:center;line-height:32px;font-weight:800;font-size:13px;margin-bottom:16px;">DH</div>
      <h1 style="margin:0 0 8px;font-size:22px;color:#0b1020;">Welcome to Design Hub</h1>
      <p style="margin:0 0 24px;color:#475569;line-height:1.5;">
        Hi ${escapeHtml(input.displayName)} — ${escapeHtml(input.invitedByName)} invited you to join Design Hub,
        the place where ideas get captured, designed, built, and shipped.
      </p>
      <a href="${input.inviteUrl}" style="display:inline-block;background:#0b1020;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Set up my account →</a>
      <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;line-height:1.5;">
        Or paste this link into your browser:<br>
        <span style="color:#475569;word-break:break-all;">${input.inviteUrl}</span>
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">
        This invitation expires on ${expires}. If you weren't expecting it, you can ignore this message.
      </p>
    </div>
  </div>
</body></html>`;
}

function renderInvitationText(input: InvitationEmailInput): string {
  const expires = new Date(input.expiresAt).toLocaleDateString();
  return [
    `Hi ${input.displayName},`,
    "",
    `${input.invitedByName} invited you to join Design Hub.`,
    "",
    "Set up your account here:",
    input.inviteUrl,
    "",
    `This invitation expires on ${expires}.`,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}
