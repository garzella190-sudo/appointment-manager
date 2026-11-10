import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { buildIcs, eventoGuida } from '@/lib/calendario';

/**
 * GET /api/calendar?id=<appuntamento>
 *
 * Vecchio endpoint "link calendario" per utenti già loggati (usa la sessione, quindi
 * passa dalle policy RLS). Genera lo STESSO .ics del resto dell'app grazie a
 * `lib/calendario` — un solo generatore, un solo formato.
 *
 * Per i link dentro le EMAIL usare invece `/api/calendar/ics` (firmato, senza login).
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return new NextResponse('Missing ID', { status: 400 });

  const supabase = await createClient();

  const { data: apt, error } = await supabase
    .from('appuntamenti')
    .select(`
      id, data, durata, inizio, note,
      clienti ( nome, cognome, email ),
      istruttori ( nome, cognome ),
      veicoli ( nome, targa )
    `)
    .eq('id', id)
    .single();

  if (error || !apt) return new NextResponse('Not Found', { status: 404 });

  const cliente = Array.isArray(apt.clienti) ? apt.clienti[0] : apt.clienti;
  const istruttore = Array.isArray(apt.istruttori) ? apt.istruttori[0] : apt.istruttori;
  const veicolo = Array.isArray(apt.veicoli) ? apt.veicoli[0] : apt.veicoli;

  const inizio = apt.inizio || apt.data;
  if (!inizio) return new NextResponse('Appuntamento senza orario', { status: 422 });

  const ics = buildIcs(
    eventoGuida({
      id: apt.id,
      inizio,
      durata: apt.durata || 60,
      cliente: cliente ? `${cliente.cognome || ''} ${cliente.nome || ''}`.trim() : null,
      istruttore: istruttore ? `${istruttore.nome || ''} ${istruttore.cognome || ''}`.trim() : null,
      veicolo: veicolo ? `${veicolo.nome || ''} (${veicolo.targa || ''})` : null,
      note: apt.note,
      emailCliente: cliente?.email ?? null,
    }),
    'PUBLISH'
  );

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="guida.ics"',
      'Cache-Control': 'no-store',
    },
  });
}
