import type { SupabaseClient } from '@supabase/supabase-js';
import type { Patente } from '@/lib/database.types';

/**
 * Elenco delle patenti ATTIVE per i selettori dell'app (scheda cliente, nuovo
 * appuntamento, istruttori, veicoli).
 *
 * PERCHÉ QUI E NON NELLA QUERY: il filtro veniva fatto con
 * `.eq('nascosta', false)`. Se la colonna `nascosta` manca oppure è `NULL` per
 * qualche riga (è stata aggiunta a mano sul database, senza `DEFAULT false`),
 * il confronto SQL `nascosta = false` non trova NESSUNA riga e i selettori
 * restano vuoti: è il bug del "picker patente senza patenti".
 * Qui invece si scaricano tutte le patenti e si scarta solo quella che ha
 * davvero `nascosta === true`.
 */
export async function caricaPatentiVisibili(supabase: SupabaseClient): Promise<Patente[]> {
  const { data, error } = await supabase.from('patenti').select('*').order('tipo');

  if (error) {
    console.error('Errore nel caricamento delle patenti:', error.message);
    return [];
  }

  return ((data || []) as unknown as Patente[]).filter((patente) => patente.nascosta !== true);
}

/**
 * Ordine dei selettori: la B per prima (è quella di gran lunga più usata),
 * poi tutte le altre in ordine alfabetico per nome/tipo.
 */
export function ordinaPatenti(patenti: Patente[]): Patente[] {
  return [...patenti].sort((a, b) => {
    const aB = a.tipo === 'B';
    const bB = b.tipo === 'B';
    if (aB && !bB) return -1;
    if (bB && !aB) return 1;
    return (a.nome_visualizzato || a.tipo).localeCompare(b.nome_visualizzato || b.tipo, 'it');
  });
}
