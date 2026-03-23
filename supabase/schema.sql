-- ============================================================
-- Schema Database – Scuola Guida Agenda
-- Supabase / PostgreSQL
-- ============================================================

-- Abilita estensioni utili
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tipi ENUM ────────────────────────────────────────────────

CREATE TYPE tipo_patente AS ENUM (
  'AM', 'A1', 'A2', 'A',
  'B1', 'B', 'B96', 'BE',
  'C1', 'C1E', 'C', 'CE',
  'D1', 'D1E', 'D', 'DE'
);

CREATE TYPE cambio_ammesso AS ENUM (
  'manuale',
  'automatico',
  'entrambi'
);

CREATE TYPE stato_appuntamento AS ENUM (
  'programmato',
  'completato',
  'annullato',
  'no_show'
);

-- ── Patenti ──────────────────────────────────────────────────
-- Deve essere creata prima di clienti (FK) e veicoli (FK array)

CREATE TABLE patenti (
  id                 UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo               tipo_patente   NOT NULL UNIQUE,
  nome_visualizzato  VARCHAR(100)   NOT NULL,
  durata_default     INTEGER        NOT NULL DEFAULT 50,  -- minuti
  cambio_ammesso     cambio_ammesso NOT NULL DEFAULT 'manuale',
  veicoli_abilitati  UUID[]         NOT NULL DEFAULT '{}', -- FK → veicoli.id (denormalizzato, vedi nota)
  eliminato_il       TIMESTAMPTZ    NULL,
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN patenti.durata_default IS 'Durata predefinita della lezione in minuti';
COMMENT ON COLUMN patenti.veicoli_abilitati IS 'Array di UUID veicoli abilitati per questo tipo di patente';

-- ── Veicoli ──────────────────────────────────────────────────

CREATE TABLE veicoli (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome             VARCHAR(100) NOT NULL,
  targa            VARCHAR(10)  NOT NULL UNIQUE,
  data_revisione   DATE         NOT NULL,
  tipo_patente     tipo_patente NOT NULL,
  cambio_manuale   BOOLEAN      NOT NULL DEFAULT TRUE,
  eliminato_il     TIMESTAMPTZ  NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN veicoli.data_revisione IS 'Scadenza della revisione ministeriale';
COMMENT ON COLUMN veicoli.cambio_manuale IS 'TRUE = cambio manuale, FALSE = automatico';

-- ── Clienti ──────────────────────────────────────────────────

CREATE TABLE clienti (
  id                    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome                  VARCHAR(100) NOT NULL,
  cognome               VARCHAR(100) NOT NULL,
  telefono              VARCHAR(20)  NULL,
  email                 VARCHAR(255) NULL,
  patente_richiesta_id  UUID         NULL REFERENCES patenti(id) ON DELETE SET NULL,
  preferenza_cambio     VARCHAR(20)  NULL, -- 'manuale', 'automatico'
  eliminato_il          TIMESTAMPTZ  NULL,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT clienti_email_unique UNIQUE (email)
);

CREATE INDEX idx_clienti_cognome ON clienti(cognome);
CREATE INDEX idx_clienti_patente  ON clienti(patente_richiesta_id);

-- ── Istruttori ───────────────────────────────────────────────

CREATE TABLE istruttori (
  id                 UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome               VARCHAR(100)  NOT NULL,
  cognome            VARCHAR(100)  NOT NULL,
  telefono           VARCHAR(20)   NULL,
  email              VARCHAR(255)  NULL UNIQUE,
  patenti_abilitate  tipo_patente[] NOT NULL DEFAULT '{}',
  eliminato_il       TIMESTAMPTZ   NULL,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN istruttori.patenti_abilitate IS 'Array dei tipi di patente che l''istruttore è abilitato a insegnare';

CREATE INDEX idx_istruttori_cognome ON istruttori(cognome);

-- ── Appuntamenti ─────────────────────────────────────────────

CREATE TABLE appuntamenti (
  id               UUID                NOT NULL DEFAULT uuid_generate_v4(),
  cliente_id       UUID                NOT NULL REFERENCES clienti(id)    ON DELETE CASCADE,
  istruttore_id    UUID                NOT NULL REFERENCES istruttori(id) ON DELETE RESTRICT,
  veicolo_id       UUID                NULL     REFERENCES veicoli(id)    ON DELETE SET NULL,
  data             TIMESTAMPTZ         NOT NULL,                           -- data e ora di inizio
  durata           INTEGER             NOT NULL DEFAULT 50,                -- durata in minuti
  stato            stato_appuntamento  NOT NULL DEFAULT 'programmato',
  importo          NUMERIC(8,2)        NULL,                               -- es. 35.00 €
  note             TEXT                NULL,
  eliminato_il     TIMESTAMPTZ         NULL,
  created_at       TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id)
);

CREATE INDEX idx_appuntamenti_data          ON appuntamenti(data);
CREATE INDEX idx_appuntamenti_cliente       ON appuntamenti(cliente_id);
CREATE INDEX idx_appuntamenti_istruttore    ON appuntamenti(istruttore_id);
CREATE INDEX idx_appuntamenti_stato         ON appuntamenti(stato);

-- ── Trigger: aggiorna updated_at automaticamente ─────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_patenti_updated_at
  BEFORE UPDATE ON patenti
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_veicoli_updated_at
  BEFORE UPDATE ON veicoli
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_clienti_updated_at
  BEFORE UPDATE ON clienti
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_istruttori_updated_at
  BEFORE UPDATE ON istruttori
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_appuntamenti_updated_at
  BEFORE UPDATE ON appuntamenti
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row Level Security (RLS) – da configurare in Supabase ────

ALTER TABLE patenti        ENABLE ROW LEVEL SECURITY;
ALTER TABLE veicoli        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clienti        ENABLE ROW LEVEL SECURITY;
ALTER TABLE istruttori     ENABLE ROW LEVEL SECURITY;
ALTER TABLE appuntamenti   ENABLE ROW LEVEL SECURITY;

-- Policy esempio: accesso completo agli utenti autenticati e anon (per development)
-- Policy restringente: Accesso solo agli utenti autenticati
DROP POLICY IF EXISTS "Accesso totale" ON patenti;
CREATE POLICY "Accesso totale" ON patenti FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Accesso totale" ON veicoli;
CREATE POLICY "Accesso totale" ON veicoli FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Accesso totale" ON clienti;
CREATE POLICY "Accesso totale" ON clienti FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Accesso totale" ON istruttori;
CREATE POLICY "Accesso totale" ON istruttori FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Accesso totale" ON appuntamenti;
CREATE POLICY "Accesso totale" ON appuntamenti FOR ALL TO authenticated USING (true);

-- ── Dati di esempio – Patenti standard italiane ──────────────

INSERT INTO patenti (tipo, nome_visualizzato, durata_default) VALUES
  ('AM',  'Patente AM',  30),
  ('A1',  'Patente A1',  50),
  ('A2',  'Patente A2',  50),
  ('A',   'Patente A',   50),
  ('B1',  'Patente B1',  50),
  ('B',   'Patente B',   50),
  ('B96', 'Patente B96', 50),
  ('BE',  'Patente BE',  60),
  ('C1',  'Patente C1',  90),
  ('C',   'Patente C',   90),
  ('C1E', 'Patente C1E', 90),
  ('CE',  'Patente CE',  90),
  ('D1',  'Patente D1',  90),
  ('D',   'Patente D',   90),
  ('D1E', 'Patente D1E', 90),
  ('DE',  'Patente DE',  90);

-- ── Tipi Impegno ─────────────────────────────────────────────

CREATE TABLE tipi_impegno (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome            VARCHAR(100) NOT NULL UNIQUE,
  durata_default  INTEGER      NULL,
  note_default    TEXT         NULL,
  eliminato_il    TIMESTAMPTZ  NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE tipi_impegno ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accesso totale" ON tipi_impegno FOR ALL TO authenticated USING (true);

-- ── Impegni ──────────────────────────────────────────────────

CREATE TABLE impegni (
  id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  istruttore_id  UUID         NULL REFERENCES istruttori(id) ON DELETE SET NULL,
  tipo           VARCHAR(100) NOT NULL,
  data           DATE         NOT NULL,
  ora_inizio     TIME         NOT NULL,
  durata         INTEGER      NOT NULL,
  note           TEXT         NULL,
  eliminato_il   TIMESTAMPTZ  NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE impegni ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accesso totale" ON impegni FOR ALL TO authenticated USING (true);

CREATE TRIGGER trg_impegni_updated_at
  BEFORE UPDATE ON impegni
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
