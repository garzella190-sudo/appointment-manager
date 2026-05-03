import { Istruttore, Veicolo, Cliente } from '@/lib/database.types';

export type Trainer = Istruttore;
export type Vehicle = Veicolo;
export type Customer = Cliente;

export interface Appointment {
  id: string;
  cliente_id?: string; // <--- AGGIUNTO IL '?' PER RENDERLO OPZIONALE
  client_name: string;
  is_impegno?: boolean;
  tipo_impegno?: string | null;
  phone?: string;
  trainer_id: string;
  vehicle_id: string;
  vehicle_id_uuid?: string | null;
  appointment_date: string;
  appointment_time: string;
  duration: number;
  notes?: string;
  sessione_esame_id?: string | null;
  status: string;
  stato: string;
  cost: number;
  license_type: string;
  gearbox_type: string;
  is_unavailability?: boolean;
  created_at?: string;
  istruttore?: {
    name: string;
    color: string;
  };
  vehicle_color?: string;
  exam_status?: 'scheduled' | 'ready' | 'none';
}