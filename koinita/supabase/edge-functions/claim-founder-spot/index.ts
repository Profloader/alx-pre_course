// Supabase Edge Function: claim-founder-spot
// Called from finishSignup() — atomically increments the founder counter
// and optionally credits the referrer.
// Deploy: supabase functions deploy claim-founder-spot

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Verify the calling user
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS })

  const { invite_code } = await req.json().catch(() => ({}))

  // Atomic founder spot claim via RPC
  const { data: spot } = await supabase.rpc('claim_founder_spot')

  // Credit referrer if invite code supplied
  if (invite_code) {
    await supabase.rpc('credit_referrer', {
      p_invite_code: invite_code,
      p_new_user_id: user.id,
    })
  }

  // Send welcome email (non-blocking)
  const { data: profile } = await supabase.from('profiles').select('name,email,founder,founder_no').eq('id', user.id).single()
  if (profile) {
    supabase.functions.invoke('send-email', {
      body: {
        to: profile.email,
        type: 'welcome',
        data: {
          name: profile.name,
          founder: String(profile.founder),
          founderNo: String(profile.founder_no ?? ''),
        },
      },
    }).catch(() => {}) // fire-and-forget
  }

  return new Response(JSON.stringify(spot), { headers: { ...CORS, 'Content-Type': 'application/json' } })
})
