export interface Trainer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  color: string;
  default_vehicle_id?: string;
  created_at?: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  name?: string;
  email?: string;
  phone?: string;
  license_types: string[];
  registration_date?: string;
  revision_expiry_date?: string;
  color?: string;
  created_at?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  requested_licenses?: string[];
  foglio_rosa_code?: string;
  foglio_rosa_issue_date?: string;
  foglio_rosa_expiry_date?: string;
  created_at?: string;
}

export interface Appointment {
  id: string;
  cliente_id: string;
  client_name: string;
  phone?: string;
  trainer_id: string;
  vehicle_id: string; // Per visualizzazione "Nome (Targa)"
  vehicle_id_uuid?: string | null; // UUID crudo per check conflitti
  appointment_date: string;
  appointment_time: string;
  duration: number; // in minutes
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
