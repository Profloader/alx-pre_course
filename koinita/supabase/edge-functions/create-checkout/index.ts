// Supabase Edge Function: create-checkout
// Creates a Stripe Checkout session for author plan upgrades.
// Deploy: supabase functions deploy create-checkout
// Env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, APP_URL

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.18.0?target=deno'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })
const APP_URL = Deno.env.get('APP_URL') || 'https://app.koinita.club'

// Map plan IDs to Stripe price IDs — set these after creating products in Stripe
const PRICE_MAP: Record<string, string> = {
  indie: Deno.env.get('STRIPE_PRICE_INDIE') || '',
  pro:   Deno.env.get('STRIPE_PRICE_PRO') || '',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS })

  const { plan } = await req.json()
  const priceId = PRICE_MAP[plan]
  if (!priceId) return new Response(JSON.stringify({ error: 'Invalid plan' }), { status: 400, headers: CORS })

  const { data: profile } = await supabase.from('profiles').select('email,name').eq('id', user.id).single()

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: profile?.email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/plans?upgraded=1`,
    cancel_url: `${APP_URL}/plans`,
    metadata: { user_id: user.id, plan },
    subscription_data: { metadata: { user_id: user.id, plan } },
  })

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})

// ── Stripe Webhook (separate deployment or same function with path check) ────
// After payment success, Stripe POSTs to this webhook.
// Writes the new plan to profiles table.
//
// stripe listen --forward-to localhost:54321/functions/v1/create-checkout/webhook
//
// export async function handleWebhook(req: Request) {
//   const sig = req.headers.get('stripe-signature')!
//   const body = await req.text()
//   const event = stripe.webhooks.constructEvent(body, sig, Deno.env.get('STRIPE_WEBHOOK_SECRET')!)
//   if (event.type === 'checkout.session.completed') {
//     const session = event.data.object as Stripe.Checkout.Session
//     const { user_id, plan } = session.metadata!
//     await supabase.from('profiles').update({ plan }).eq('id', user_id)
//   }
// }
