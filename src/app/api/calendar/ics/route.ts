import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { buildIcs, eventoGuida, verificaFirmaCalendario } from '@/lib/calendario';

/**
 * GET /api/calendar/ics?id=<appuntamento>&firma=<hmac>
 *
 * Restituisce il file .ics della guida. È il link "Aggiungi al calendario" che
 * finisce nelle email: deve funzionare dal telefono del CLIENTE, quindi non c'è
 * login ma una firma HMAC sull'id (vedi `lib/calendario.ts`). Senza firma valida
 * la richiesta viene rifiutata: gli appuntamenti non sono indovinabili così.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const firma = request.nextUrl.searchParams.get('firma');

  if (!id) return new NextResponse('Parametro id mancante', { status: 400 });
  if (!verificaFirmaCalendario(id, firma)) {
    return new NextResponse('Link non valido', { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: apt, error } = await supabase
    .from('appuntamenti')
    .select(`
      id, inizio, durata, note, data,
      clienti ( nome, cognome, email ),
      istruttori ( nome, cognome ),
      veicoli ( nome, targa )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error || !apt) return new NextResponse('Appuntamento non trovato', { status: 404 });

  const cliente = Array.isArray(apt.clienti) ? apt.clienti[0] : apt.clienti;
  const istruttore = Array.isArray(apt.istruttori) ? apt.istruttori[0] : apt.istruttori;
  const veicolo = Array.isArray(apt.veicoli) ? apt.veicoli[0] : apt.veicoli;

  const inizio = apt.inizio || apt.data;
  if (!inizio) return new NextResponse('Appuntamento senza orario', { status: 422 });

  const evento = eventoGuida({
    id: apt.id,
    inizio,
    durata: apt.durata || 60,
    cliente: cliente ? `${cliente.cognome || ''} ${cliente.nome || ''}`.trim() : null,
    istruttore: istruttore ? `${istruttore.nome || ''} ${istruttore.cognome || ''}`.trim() : null,
    veicolo: veicolo ? `${veicolo.nome || ''} (${veicolo.targa || ''})` : null,
    note: apt.note,
    emailCliente: cliente?.email ?? null,
  });

  const ics = buildIcs(evento, 'REQUEST');

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="guida.ics"',
      'Cache-Control': 'no-store',
    },
  });
}
