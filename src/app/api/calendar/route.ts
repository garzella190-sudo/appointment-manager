import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { format, parseISO, addMinutes } from 'date-fns';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');

  if (!id) return new NextResponse('Missing ID', { status: 400 });

  // Use a minimal client to fetch appointment
  // Using Service Role might be needed if the appointment is private, 
  // but for a public calendar link, common ID is usually fine.
  const supabase = await createClient();
  
  const { data: apt, error } = await supabase
    .from('appuntamenti')
    .select(`
      id, data, durata, inizio, 
      istruttori ( nome, cognome ),
      veicoli ( nome, targa )
    `)
    .eq('id', id)
    .single();

  if (error || !apt) return new NextResponse('Not Found', { status: 404 });

  const address = "Via Le Vallicelle, 4, 56043 Fauglia (PI)";
  const startDate = new Date(apt.inizio);
  const endDate = addMinutes(startDate, apt.durata || 60);
  const formatICS = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Autoscuola Toscana Fauglia//Appointment Manager//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:apt-${apt.id}-${startDate.getTime()}@autoscuola.toscana`,
    `DTSTAMP:${formatICS(new Date())}`,
    `DTSTART:${formatICS(startDate)}`,
    `DTEND:${formatICS(endDate)}`,
    `SUMMARY:Lezione di Guida`,
    `DESCRIPTION:Sede: Autoscuola Toscana Fauglia\\nIndirizzo: ${address}\\nUn promemoria per la tua lezione di guida.`,
    'LOCATION:Autoscuola Toscana Fauglia',
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Promemoria Lezione di Guida',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return new NextResponse(icsContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="guida_${format(startDate, 'yyyyMMdd')}.ics"`,
    },
  });
}
