-- Aggiunta campi per Esami alla tabella clienti
ALTER TABLE clienti ADD COLUMN IF NOT EXISTS pronto_esame BOOLEAN DEFAULT FALSE;
ALTER TABLE clienti ADD COLUMN IF NOT EXISTS data_pronto_esame TIMESTAMP WITH TIME ZONE;

-- Tabella Sessioni Esame
CREATE TABLE IF NOT EXISTS sessioni_esame (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  n_candidati INTEGER DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella Impostazioni Sistema (per inibizione funzioni)
CREATE TABLE IF NOT EXISTS impostazioni_sistema (
    id TEXT PRIMARY KEY DEFAULT 'config_globale',
    hide_gestione_for_others BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserimento record iniziale per impostazioni se non esiste
INSERT INTO impostazioni_sistema (id, hide_gestione_for_others)
VALUES ('config_globale', FALSE)
ON CONFLICT (id) DO NOTHING;
