// Supabase Edge Function: send-email
// Triggered server-side to send transactional emails via Resend.
// Deploy: supabase functions deploy send-email
// Env vars needed: RESEND_API_KEY, FROM_EMAIL

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const RESEND_API = 'https://api.resend.com/emails'
const FROM = Deno.env.get('FROM_EMAIL') || 'Koinita <hello@koinita.club>'
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') || ''

interface EmailPayload {
  to: string
  type: 'welcome' | 'drop_alert' | 'reply_notify' | 'invite_accepted' | 'book_approved' | 'book_rejected' | 'weekly_digest'
  data: Record<string, string>
}

const templates: Record<string, (d: Record<string, string>) => { subject: string; html: string }> = {
  welcome: (d) => ({
    subject: `Welcome to Koinita, ${d.name} ✦`,
    html: `<p>Hi ${d.name},</p>
<p>You're ${d.founder ? `Founding Member <b>№${d.founderNo}</b>` : 'now a member'} of <b>Koinita Book Club</b>.</p>
<p>Every book on the shelf is yours to claim and keep — free, with a direct line to the author.</p>
<p><a href="https://app.koinita.club">Open the club →</a></p>
<p style="color:#988C79;font-size:13px">You can unsubscribe at any time from your <a href="https://app.koinita.club/notifs">notification settings</a>.</p>`,
  }),

  drop_alert: (d) => ({
    subject: `"${d.title}" just dropped free on Koinita`,
    html: `<p>Hi ${d.name},</p>
<p>The book you were waiting on is now live on the free shelf:</p>
<h2>${d.title}</h2>
<p>by ${d.authorName}</p>
<p><a href="https://app.koinita.club">Claim it now →</a></p>
<p style="color:#988C79;font-size:13px"><a href="https://app.koinita.club/notifs">Unsubscribe</a></p>`,
  }),

  reply_notify: (d) => ({
    subject: `${d.fromName} replied to you on Koinita`,
    html: `<p>Hi ${d.toName},</p>
<p><b>${d.fromName}</b> replied in your conversation about <b>${d.bookTitle}</b>:</p>
<blockquote style="border-left:3px solid #D9541F;padding-left:14px;color:#6A6052">${d.preview}</blockquote>
<p><a href="https://app.koinita.club">Read &amp; reply →</a></p>
<p style="color:#988C79;font-size:13px"><a href="https://app.koinita.club/notifs">Unsubscribe</a></p>`,
  }),

  invite_accepted: (d) => ({
    subject: `${d.newMemberName} joined from your invite ✦`,
    html: `<p>Hi ${d.name},</p>
<p><b>${d.newMemberName}</b> just joined Koinita from your invite link.</p>
${d.charter === 'true'
  ? `<p>🎉 You've now earned <b>✦ Charter Member</b> status — you've referred 5 members or more.</p>`
  : `<p>You've referred <b>${d.invites} member${Number(d.invites) !== 1 ? 's' : ''}</b> so far. Refer 5 total to earn ✦ Charter status.</p>`}
<p><a href="https://app.koinita.club/founders">View the Founders' Wall →</a></p>`,
  }),

  book_approved: (d) => ({
    subject: `"${d.title}" is now live on the shelf ✓`,
    html: `<p>Hi ${d.name},</p>
<p>Your book <b>${d.title}</b> has been approved and is now live on the Koinita shelf.</p>
<p><a href="https://app.koinita.club">View your listing →</a></p>`,
  }),

  book_rejected: (d) => ({
    subject: `Update on "${d.title}"`,
    html: `<p>Hi ${d.name},</p>
<p>Your book <b>${d.title}</b> wasn't approved for the shelf right now.</p>
${d.reason ? `<p>Reason: ${d.reason}</p>` : ''}
<p>If you have questions, reply to this email and the team will get back to you.</p>`,
  }),

  weekly_digest: (d) => ({
    subject: `Your Koinita weekly digest ✦`,
    html: `<p>Hi ${d.name},</p>
<p>Here's what happened this week on Koinita:</p>
${d.body}
<p><a href="https://app.koinita.club">Open the club →</a></p>
<p style="color:#988C79;font-size:13px"><a href="https://app.koinita.club/notifs">Unsubscribe from digest</a></p>`,
  }),
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const payload: EmailPayload = await req.json()
    const tpl = templates[payload.type]
    if (!tpl) return new Response(JSON.stringify({ error: 'Unknown template' }), { status: 400 })

    const { subject, html } = tpl(payload.data)

    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: payload.to, subject, html }),
    })

    const json = await res.json()
    return new Response(JSON.stringify(json), { status: res.status, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
