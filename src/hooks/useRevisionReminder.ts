/**
 * useRevisionReminder
 * Calcola lo stato della scadenza revisione e genera un link
 * per aggiungere un reminder al calendario (Google Calendar).
 */
export function useRevisionReminder(dataRevisione: string | null) {
  if (!dataRevisione) {
    return { isExpired: false, isNearExpiry: false, daysLeft: null, calendarUrl: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dataRevisione);
  expiry.setHours(0, 0, 0, 0);

  const diffMs   = expiry.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const isExpired    = daysLeft < 0;
  const isNearExpiry = !isExpired && daysLeft <= 30;

  // Genera URL Google Calendar per aggiungere reminder
  const startDate = expiry.toISOString().split('T')[0].replace(/-/g, '');
  const nextDay = new Date(expiry);
  nextDay.setDate(nextDay.getDate() + 1);
  const endDate = nextDay.toISOString().split('T')[0].replace(/-/g, '');
  const calendarUrl = `https://calendar.google.com/calendar/r/eventedit?text=Scadenza+Revisione+Veicolo&dates=${startDate}/${endDate}&details=Ricorda+di+prenotare+la+revisione+ministeriale&sf=true&output=xml`;

  return { isExpired, isNearExpiry, daysLeft, calendarUrl };
}
