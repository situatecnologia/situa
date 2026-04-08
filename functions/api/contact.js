export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return json(
        { ok: false, error: "Content-Type inválido. Use application/json." },
        415
      );
    }

    const body = await request.json();

    const nome = sanitizeText(body.nome, 120);
    const email = sanitizeEmail(body.email);
    const mensagem = sanitizeText(body.mensagem, 4000);

    if (!nome || !email || !mensagem) {
      return json(
        { ok: false, error: "Nome, email e mensagem são obrigatórios." },
        400
      );
    }

    if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !env.TO_EMAIL) {
      return json(
        { ok: false, error: "Variáveis de ambiente não configuradas." },
        500
      );
    }

    const ip =
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("x-forwarded-for") ||
      "não informado";

    const userAgent = request.headers.get("user-agent") || "não informado";
    const origin = request.headers.get("origin") || "não informado";

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111827;">
        <h2 style="margin:0 0 16px;">Novo lead recebido no site da SITUA</h2>

        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:720px;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><strong>Nome</strong></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml(nome)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><strong>Email</strong></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml(email)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><strong>IP</strong></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml(ip)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><strong>Origem</strong></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml(origin)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><strong>User-Agent</strong></td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml(userAgent)}</td>
          </tr>
        </table>

        <div style="margin-top:20px;">
          <strong>Mensagem</strong>
          <div style="margin-top:8px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;white-space:pre-wrap;">
${escapeHtml(mensagem)}
          </div>
        </div>
      </div>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: [env.TO_EMAIL],
        subject: `Novo lead no site SITUA — ${nome}`,
        reply_to: email,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      return json(
        { ok: false, error: "Falha ao enviar e-mail.", details: errorText },
        502
      );
    }

    return json({ ok: true, message: "Lead enviado com sucesso." }, 200);
  } catch (error) {
    return json(
      {
        ok: false,
        error: "Erro interno ao processar o formulário.",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function sanitizeText(value, maxLength = 1000) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeEmail(value) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return isValid ? email.slice(0, 254) : "";
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
