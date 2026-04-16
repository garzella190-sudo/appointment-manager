import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { format, addHours, startOfDay, endOfDay } from "https://esm.sh/date-fns@2"
import { it } from "https://esm.sh/date-fns@2/locale"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const { mode } = await req.json() // '24h' or 'morning'

    let query = supabase
      .from('appuntamenti')
      .select('id, data, inizio, durata, send_email, clienti(nome, email), istruttori(nome, cognome), veicoli(nome, targa)')
      .eq('send_email', true)
      .neq('stato', 'annullato')

    const now = new Date()

    if (mode === '24h') {
      // Find appointments starting between 23.5 and 24.5 hours from now
      const targetStart = addHours(now, 23.5).toISOString()
      const targetEnd = addHours(now, 24.5).toISOString()
      query = query.gte('inizio', targetStart).lte('inizio', targetEnd)
    } else if (mode === 'morning') {
      // Find all appointments for today
      const todayStart = startOfDay(now).toISOString()
      const todayEnd = endOfDay(now).toISOString()
      query = query.gte('inizio', todayStart).lte('inizio', todayEnd)
    }

    const { data: appointments, error } = await query

    if (error) throw error

    console.log(`Found ${appointments?.length || 0} appointments for mode ${mode}`)

    const results = []
    for (const apt of appointments || []) {
      if (!apt.clienti?.email) continue

      // Call the Resend API (centralized logic)
      // Since we can't call the Next.js Server Action directly from here easily,
      // we implement the minimal Resend call or trigger an internal endpoint.
      // For simplicity and robustness in Edge Functions, we re-implement the Resend call here.
      const startDate = new Date(apt.inizio);
      const endDate = addHours(startDate, 1);
      const formatICS = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
      const address = "Via Le Vallicelle, 4, 56043 Fauglia (PI)";
      
      const icsStr = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Autoscuola Toscana Fauglia//IT',
        'BEGIN:VEVENT',
        `DTSTART:${formatICS(startDate)}`,
        `DTEND:${formatICS(endDate)}`,
        `SUMMARY:Lezione di Guida`,
        `DESCRIPTION:Sede: Autoscuola Toscana Fauglia\\nIndirizzo: ${address}`,
        'LOCATION:Autoscuola Toscana Fauglia',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Autoscuola Toscana Fauglia <onboarding@resend.dev>',
          to: apt.clienti.email,
          subject: mode === '24h' ? 'Promemoria: Lezione di Guida Domani' : 'Promemoria: Lezione di Guida Oggi',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; text-align: center; border: 1px solid #f3f4f6; border-radius: 24px; padding: 40px;">
              <h2 style="color: #6b7280; font-size: 18px; font-weight: 700; margin-bottom: 24px;">Promemoria</h2>
              <p style="font-size: 20px; color: #111827; margin-bottom: 40px; font-weight: 600;">Ricorda la guida programmata per <strong>${format(new Date(apt.inizio), "EEEE d MMMM 'alle' HH:mm", { locale: it })}</strong></p>
              
              <p style="font-size: 16px; color: #ef4444; font-weight: bold; text-align: center; margin-bottom: 48px; line-height: 1.6;">
                NB: le guide vanno disdette 24h prima, pena addebito dell'importo
              </p>
              <p style="font-size: 16px; color: #6b7280; font-weight: 500; text-align: center; margin: 0;">
                Per disdire le guide chiama in autoscuola oppure contatta il tuo istruttore
              </p>
            </div>
          `,
          attachments: [
            {
              filename: 'guida.ics',
              content: btoa(icsStr)
            }
          ]
        }),
      })

      results.push({ id: apt.id, success: res.ok })
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
