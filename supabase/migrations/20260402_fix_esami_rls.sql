-- Aggiunta colonna mancante 'nome' (causa potenziale di errori)
ALTER TABLE sessioni_esame ADD COLUMN IF NOT EXISTS nome TEXT;

-- Abilitazione Row Level Security
ALTER TABLE sessioni_esame ENABLE ROW LEVEL SECURITY;

-- Pulizia policy esistenti (per sicurezza)
DROP POLICY IF EXISTS "Admin full access" ON sessioni_esame;
DROP POLICY IF EXISTS "Authenticated read access" ON sessioni_esame;

-- Policy per Admin: Accesso totale (Insert, Update, Delete, Select)
CREATE POLICY "Admin full access" 
ON sessioni_esame 
FOR ALL 
TO authenticated 
USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');

-- Policy per Segreteria: Visualizzazione e Inserimento (se necessario)
-- Nota: Il cliente ha chiesto che Admin crei le sedute, ma spesso la segreteria aiuta.
-- Per ora limitiamo a Select per coerenza col messaggio d'errore (visto che l'utente è Admin).
CREATE POLICY "Segreteria access" 
ON sessioni_esame 
FOR SELECT 
TO authenticated 
USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'segreteria');

-- Policy per Istruttori: Sola visualizzazione
CREATE POLICY "Istruttore access" 
ON sessioni_esame 
FOR SELECT 
TO authenticated 
USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'istruttore');

-- Permessi per il ruolo service_role (usato internamente da Supabase)
ALTER TABLE sessioni_esame FORCE ROW LEVEL SECURITY;
GRANT ALL ON sessioni_esame TO service_role;
GRANT ALL ON sessioni_esame TO authenticated;
GRANT ALL ON sessioni_esame TO postgres;
