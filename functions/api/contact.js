export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const nome = (body.nome || "").trim();
    const email = (body.email || "").trim();
    const mensagem = (body.mensagem || "").trim();

    if (!nome || !email || !mensagem) {
      return new Response(
        JSON.stringify({ ok: false, error: "Campos obrigatórios ausentes." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

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
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;">
            <h2>Novo lead recebido no site da SITUA</h2>
            <p><strong>Nome:</strong> ${escapeHtml(nome)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Mensagem:</strong></p>
            <div style="padding:12px;border:1px solid #ddd;border-radius:8px;">
              ${escapeHtml(mensagem).replace(/\n/g, "<br>")}
            </div>
          </div>
        `,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      return new Response(
        JSON.stringify({ ok: false, error: errorText }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: "Erro interno ao processar lead." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
