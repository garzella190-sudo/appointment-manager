// ============================================================
// Database Types – Scuola Guida Agenda
// Generated from Supabase PostgreSQL schema
// ============================================================

export type TipoPatente = 'AM' | 'A1' | 'A2' | 'A' | 'B1' | 'B' | 'B96' | 'BE' | 'C1' | 'C1E' | 'C' | 'CE' | 'D1' | 'D1E' | 'D' | 'DE';
export type TipoCambio = 'manuale' | 'automatico';
export type CambioAmmesso = 'manuale' | 'automatico' | 'entrambi';
export type StatoAppuntamento = 'programmato' | 'completato' | 'annullato' | 'no_show';

// ── Patenti ──────────────────────────────────────────────────
export interface Patente {
  id: string;                          // uuid
  tipo: TipoPatente;                   // es. 'B', 'A2'
  nome_visualizzato: string;           // es. 'Patente B Standard'
  durata_default: number;              // durata lezione in minuti (default)
  cambio_ammesso: CambioAmmesso;       // manuale, automatico, entrambi
  veicoli_abilitati: string[];         // array di veicolo.id
  nascosta: boolean;                   // true se la patente non deve essere mostrata
  created_at: string;
  updated_at: string;
}

// ── Veicoli ──────────────────────────────────────────────────
export interface Veicolo {
  id: string;                          // uuid
  nome: string;                        // es. "Fiat Panda"
  targa: string;                       // univoca
  data_revisione: string;              // ISO date
  tipo_patente: TipoPatente;
  cambio_manuale: boolean;
  colore: string;
  created_at: string;
  updated_at: string;
}

// ── Clienti ──────────────────────────────────────────────────
export interface Cliente {
  id: string;                          // uuid
  nome: string;
  cognome: string;
  telefono: string | null;
  email: string | null;
  patente_richiesta_id: string | null; // FK → patenti.id
  preferenza_cambio: TipoCambio | null; // manuale, automatico
  riceve_email: boolean;
  riceve_whatsapp: boolean;
  pronto_esame?: boolean;              // Optional depending on view
  data_pronto_esame?: string | null;   // Optional depending on view
  sessione_esame_id?: string | null;   // FK
  istruttore_pronto_id?: string | null; // FK -> istruttori.id
  archiviato?: boolean;
  created_at: string;
  updated_at: string;
}

// ── Istruttori ───────────────────────────────────────────────
export interface Istruttore {
  id: string;                          // uuid
  nome: string;                        // Backwards compatibility
  cognome: string;                     // Backwards compatibility
  phone?: string | null;               // DEPRECATED
  telefono: string | null;
  email: string | null;
  patenti_abilitate: TipoPatente[];    // array di tipi patente
  colore: string;
  veicolo_default_id: string | null;   // DEPRECATED: use veicolo_id
  veicolo_id: string | null;           // FK → veicoli.id (veicolo preferito)
  created_at: string;
  updated_at: string;
}

// ── Appuntamenti ─────────────────────────────────────────────
export interface Appuntamento {
  id: string;                          // uuid
  cliente_id: string;                  // FK → clienti.id
  istruttore_id: string;               // FK → istruttori.id
  veicolo_id: string | null;           // FK → veicoli.id (opzionale)
  data: string;                        // ISO date
  inizio: string;                      // ISO datetime (start)
  fine: string;                        // ISO datetime (end)
  durata: number;                      // minuti
  stato: StatoAppuntamento;
  importo: number | null;              // in centesimi o decimale
  note: string | null;
  annullato: boolean;
  send_email: boolean;
  send_whatsapp: boolean;
  created_at: string;
  updated_at: string;
}

// ── Join Types (query results con foreign keys espanse) ──────
// ── AppuntamentoConDettagli (usato nella Scheda Cliente) ────
export interface AppuntamentoConDettagli {
  id: string;
  data: string;
  durata: number;
  stato: StatoAppuntamento;
  importo: number | null;
  note: string | null;
  annullato: boolean;
  istruttore: {
    id: string;
    nome: string;
    cognome: string;
  } | null;
  veicolo: {
    id: string;
    nome: string;
    targa: string;
  } | null;
}

export const STATO_CONFIG: Record<StatoAppuntamento, { label: string; color: string }> = {
  programmato: { label: 'Programmato', color: 'blue' },
  completato:  { label: 'Completato',  color: 'green' },
  annullato:   { label: 'Annullato',   color: 'red' },
  no_show:     { label: 'No Show',     color: 'amber' },
};

export interface AppuntamentoDettagliato extends Appuntamento {
  cliente: Pick<Cliente, 'id' | 'nome' | 'cognome' | 'telefono'>;
  istruttore: Pick<Istruttore, 'id' | 'nome' | 'cognome' | 'colore'>;
  veicolo: Pick<Veicolo, 'id' | 'nome' | 'targa' | 'colore'> | null;
}

export interface ClienteDettagliato extends Cliente {
  patente_richiesta: Patente | null;
}

// ── Sessioni Esame ───────────────────────────────────────────
export interface SessioneEsame {
  id: string;                          // uuid
  nome: string | null;
  data: string;                        // ISO date
  ora_inizio: string;
  n_candidati: number;
  istruttori_ids: string[];            // Array di UUID
  note: string | null;
  created_at: string;
  updated_at: string;
}

// ── Impegni ──────────────────────────────────────────────────
export interface TipoImpegno {
  id: string;
  nome: string;
  durata_default: number | null;
  note_default: string | null;
  created_at: string;
}

export interface Impegno {
  id: string;
  istruttore_id: string | null; // NULL per impegni generali
  tipo: string;
  data: string;       // ISO date
  ora_inizio: string; // HH:mm:ss or HH:mm
  durata: number;     // minuti
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImpegnoDettagliato extends Impegno {
  istruttore: Pick<Istruttore, 'id' | 'nome' | 'cognome' | 'colore'>;
}
