// ============================================================
// VELOXA Email Worker — Cloudflare Worker
// Deploy kat: https://dash.cloudflare.com/workers
// Set environment variable: RESEND_API_KEY = re_xxxx
// ============================================================

const ALLOWED_ORIGINS = [
  'https://veloxa-pm.pages.dev',
  'https://veloxa-mnsb.pages.dev',
  'https://veloxa-email-worker.snsgoldresources.workers.dev',
  'http://localhost',
  'http://127.0.0.1',
  'null'
];

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: corsHeaders(origin)
      });
    }

    try {
      const body = await request.json();
      const { type } = body;

      if (type === 'welcome') {
        return await sendWelcome(body, env, origin);
      } else if (type === 'reset') {
        return await sendReset(body, env, origin);
      } else if (type === 'mom') {
        return await sendMomEmail(body, env, origin);
      } else {
        return new Response(JSON.stringify({ error: 'Unknown email type' }), {
          status: 400, headers: corsHeaders(origin)
        });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: corsHeaders(origin)
      });
    }
  }
};

// ── WELCOME EMAIL ──────────────────────────────────────────
async function sendWelcome(data, env, origin) {
  const { to_name, to_email, temp_pass, role, company, login_url } = data;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Inter',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(13,21,38,0.1)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d1526,#1a2d4a);padding:32px 40px;text-align:center">
            <table cellpadding="0" cellspacing="0" align="center">
              <tr>
                <td style="padding-right:12px">
                  <div style="width:44px;height:44px;background:#0a1628;border-radius:12px;display:inline-flex;align-items:center;justify-content:center">
                    <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="100" height="100" rx="22" fill="#0a1628"/>
                      <path d="M15,15 L36,15 L50,68 L40,68 Z" fill="#1a56db"/>
                      <path d="M85,15 L64,15 L50,68 L60,68 Z" fill="#60a5fa"/>
                    </svg>
                  </div>
                </td>
                <td>
                  <span style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;letter-spacing:3px;color:white">VELOXA</span>
                </td>
              </tr>
            </table>
            <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:10px 0 0">Project & Operations Management Platform</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <h2 style="color:#0d1526;font-size:22px;margin:0 0 8px">Welcome, ${to_name}! 👋</h2>
            <p style="color:#4a5578;font-size:14px;line-height:1.6;margin:0 0 24px">
              Your VELOXA account has been created by admin <strong>${company}</strong>. 
              Use the credentials below to sign in for the first time.
            </p>

            <!-- Credentials Box -->
            <div style="background:#f4f6fb;border:1px solid #dde2f0;border-radius:12px;padding:20px 24px;margin-bottom:24px">
              <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#8896b8;margin:0 0 14px">Sign In Credentials</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:10px">
                    <span style="font-size:12px;color:#8896b8;display:block;margin-bottom:3px">Email</span>
                    <span style="font-size:15px;font-weight:600;color:#0d1526">${to_email}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:10px">
                    <span style="font-size:12px;color:#8896b8;display:block;margin-bottom:3px">Temporary Password</span>
                    <span style="font-size:15px;font-weight:700;color:#1a56db;font-family:'Courier New',monospace;background:#dbeafe;padding:4px 10px;border-radius:6px">${temp_pass}</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <span style="font-size:12px;color:#8896b8;display:block;margin-bottom:3px">Role</span>
                    <span style="font-size:13px;font-weight:600;color:white;background:#1a56db;padding:3px 12px;border-radius:20px;display:inline-block">${role}</span>
                  </td>
                </tr>
              </table>
            </div>

            <p style="color:#dc2626;font-size:12px;background:#fee2e2;border-radius:8px;padding:10px 14px;margin:0 0 24px">
              ⚠️ <strong>Change your password</strong> as soon as you sign in for the first time.
            </p>

            <!-- CTA Button -->
            <div style="text-align:center;margin-bottom:24px">
              <a href="${login_url}" style="display:inline-block;background:linear-gradient(135deg,#1a56db,#2563eb);color:white;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(26,86,219,0.3)">
                Sign In to VELOXA →
              </a>
            </div>

            <p style="color:#8896b8;font-size:12px;text-align:center;margin:0">
              If you have any issues, contact admin at <a href="mailto:${data.admin_email||''}" style="color:#1a56db">${data.admin_email||company}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f4f6fb;border-top:1px solid #dde2f0;padding:20px 40px;text-align:center">
            <p style="color:#8896b8;font-size:11px;margin:0">© ${new Date().getFullYear()} VELOXA · ${company} · This email was auto-generated</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${company} VELOXA <noreply@${env.FROM_DOMAIN || 'veloxa.mnsb.com'}>`,
      to:   [to_email],
      subject: `Welcome to VELOXA, ${to_name}! 🎉`,
      html,
    }),
  });

  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Resend error');
  return new Response(JSON.stringify({ success: true, id: result.id }), {
    status: 200, headers: corsHeaders(origin)
  });
}

// ── RESET PASSWORD EMAIL ───────────────────────────────────
async function sendReset(data, env, origin) {
  const { to_name, to_email, reset_link, company } = data;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 20px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(13,21,38,0.1)">
        <tr>
          <td style="background:linear-gradient(135deg,#0d1526,#1a2d4a);padding:28px 40px;text-align:center">
            <span style="font-family:Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:3px;color:white">VELOXA</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px">
            <h2 style="color:#0d1526;font-size:20px;margin:0 0 12px">Reset Password 🔑</h2>
            <p style="color:#4a5578;font-size:14px;line-height:1.6;margin:0 0 24px">
              Hi <strong>${to_name}</strong>, we received a password reset request for your VELOXA account.
              Click the button below to set a new password.
            </p>
            <div style="text-align:center;margin-bottom:24px">
              <a href="${reset_link}" style="display:inline-block;background:linear-gradient(135deg,#1a56db,#2563eb);color:white;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;box-shadow:0 4px 14px rgba(26,86,219,0.3)">
                Reset Password →
              </a>
            </div>
            <p style="color:#8896b8;font-size:12px;text-align:center;margin:0 0 8px">
              This link will expire in <strong>1 hour</strong>.
            </p>
            <p style="color:#8896b8;font-size:12px;text-align:center;margin:0">
              If you did not request a password reset, please ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f6fb;border-top:1px solid #dde2f0;padding:16px 40px;text-align:center">
            <p style="color:#8896b8;font-size:11px;margin:0">© ${new Date().getFullYear()} VELOXA · ${company}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${company} VELOXA <noreply@${env.FROM_DOMAIN || 'veloxa.mnsb.com'}>`,
      to:   [to_email],
      subject: `Reset Password VELOXA`,
      html,
    }),
  });

  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Resend error');
  return new Response(JSON.stringify({ success: true, id: result.id }), {
    status: 200, headers: corsHeaders(origin)
  });
}

// ── MOM EMAIL ──────────────────────────────────────────────
async function sendMomEmail(data, env, origin) {
  const { to_name, to_email, subject, html, company } = data;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${company} VELOXA <noreply@${env.FROM_DOMAIN || 'resend.dev'}>`,
      to:   [to_email],
      subject: subject || 'VELOXA Minutes of Meeting',
      html,
    }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Resend error');
  return new Response(JSON.stringify({ success: true, id: result.id }), {
    status: 200, headers: corsHeaders(origin)
  });
}
