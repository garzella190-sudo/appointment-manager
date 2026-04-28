-- 1. TABELLA PER I CONFLITTI DI SINCRONIZZAZIONE (OFFLINE)
CREATE TABLE IF NOT EXISTS public.sync_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    action TEXT NOT NULL,
    payload JSONB NOT NULL,
    conflict_reason TEXT NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.sync_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.sync_conflicts FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.sync_conflicts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.sync_conflicts FOR UPDATE USING (true);


-- 2. TABELLA PER LE NOTIFICHE WEB PUSH
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Evitiamo di avere duplicati per lo stesso abbonamento/dispositivo
ALTER TABLE public.push_subscriptions ADD CONSTRAINT unique_subscription UNIQUE (subscription);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
-- Ogni utente può gestire solo i propri dispositivi
CREATE POLICY "Users can insert their own subscriptions" ON public.push_subscriptions 
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can select their own subscriptions" ON public.push_subscriptions 
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own subscriptions" ON public.push_subscriptions 
    FOR DELETE USING (auth.uid() = user_id);
