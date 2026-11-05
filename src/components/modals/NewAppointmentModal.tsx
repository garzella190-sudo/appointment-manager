'use client';

import React from 'react';
import { Modal } from '@/components/Modal';
import { AppointmentForm } from '@/components/forms/AppointmentForm';

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
  initialTime?: string;
  /** Istruttore già scelto (click su una colonna in vista a colonne) */
  initialIstruttoreId?: string;
}

/**
 * NewAppointmentModal - SSOT per la creazione di appuntamenti.
 * Design Standard: Width identica a DetailsModal, Rounded-[32px].
 */
const NewAppointmentModal = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  initialDate,
  initialTime,
  initialIstruttoreId
}: NewAppointmentModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuovo Appuntamento"
    >
      <div className="mt-2">
        {isOpen && (
          <AppointmentForm 
            onSuccess={onSuccess} 
            onCancel={onClose}
            initialDate={initialDate}
            initialTime={initialTime}
            initialIstruttoreId={initialIstruttoreId}
            initialMode="create"
          />
        )}
      </div>
    </Modal>
  );
};

export default NewAppointmentModal;
