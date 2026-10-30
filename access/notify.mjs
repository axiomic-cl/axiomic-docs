// Email the team each «Pedir acceso» request through Resend, so someone issues the key.
// Best effort: the request is already in D1, so a failed notice never fails the form.

const RESEND = 'https://api.resend.com/emails';
// Resend's shared sender delivers only to the Resend account's own address, which is all an
// internal notice needs; NOTIFY_FROM takes over once axiomic.cl is verified in Resend.
const DEFAULT_FROM = 'Axiomic Docs <onboarding@resend.dev>';

/** The notice as plain text: no HTML, so nothing the requester typed is ever rendered. */
export function noticeEmail(request, { to, from }) {
	const { email, name, company, intended_use: use, created_at: createdAt } = request;
	return {
		from: from || DEFAULT_FROM,
		to: [to],
		reply_to: email,
		subject: 'Nueva solicitud de acceso a la API de prueba',
		text: [
			`${name} pidió una llave de prueba el ${createdAt}.`,
			'',
			`Correo: ${email}`,
			`Empresa: ${company || '(no indicó)'}`,
			'',
			'Qué quiere construir:',
			use,
			'',
			'Responder a este correo le escribe directo. La solicitud se borra de D1 a los 90 días.',
		].join('\n'),
	};
}

/** Send the notice when RESEND_KEY and NOTIFY_TO are bound; true only if Resend accepted it. */
export async function notifyTeam(request, env, fetchImpl) {
	if (!env.RESEND_KEY || !env.NOTIFY_TO) return false;
	try {
		const response = await fetchImpl(RESEND, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.RESEND_KEY}`,
				'Content-Type': 'application/json',
				'User-Agent': 'axiomic-docs',
			},
			body: JSON.stringify(noticeEmail(request, { to: env.NOTIFY_TO, from: env.NOTIFY_FROM })),
		});
		// Only the status: the body could echo the request.
		if (!response.ok) console.error(`access notice: Resend answered ${response.status}`);
		return response.ok;
	} catch {
		console.error('access notice: Resend unreachable');
		return false;
	}
}
