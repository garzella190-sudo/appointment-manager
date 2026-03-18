'use client';

import React from 'react';
import { Modal } from '@/components/Modal';
import { AppointmentForm } from '@/components/forms/AppointmentForm';

interface DetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appointmentId: string;
}

/**
 * DetailsModal - Pop-up di visualizzazione/dettaglio.
 * Design Standard: Mirroring di NewAppointmentModal (Width, Padding, Gap).
 */
const DetailsModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  appointmentId 
}: DetailsModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Dettagli Appuntamento"
    >
      <div className="mt-2">
        <AppointmentForm
          appointmentId={appointmentId}
          initialMode="view"
          onSuccess={onSuccess}
          onCancel={onClose}
        />
      </div>
    </Modal>
  );
};

export default DetailsModal;
