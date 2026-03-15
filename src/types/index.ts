export interface Appointment {
  id: string;
  cliente_id?: string; // <--- AGGIUNTO IL '?' PER RENDERLO OPZIONALE
  client_name: string;
  phone?: string;
  trainer_id: string;
  vehicle_id: string;
  vehicle_id_uuid?: string | null;
  appointment_date: string;
  appointment_time: string;
  duration: number;
  notes?: string;
  status: 'scheduled' | 'done' | 'cancelled';
  cost: number;
  license_type: string;
  gearbox_type: 'Manual' | 'Automatic';
  is_unavailability?: boolean;
  created_at?: string;
  trainers?: {
    name: string;
    color: string;
  };
  vehicle_color?: string;
}