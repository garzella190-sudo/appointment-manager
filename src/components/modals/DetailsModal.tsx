'use client';

import React from 'react';
import { Modal } from '@/components/Modal';
import { AppointmentForm } from '@/components/forms/AppointmentForm';

interface DetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appointmentId: string;
  /**
   * true = è un "Altro impegno": il pop-up deve aprirsi sulla scheda ALTRO IMPEGNO
   * (senza questo si apriva sempre su "Guida cliente" e non si vedevano note,
   * promemoria e nome dell'impegno).
   */
  isImpegno?: boolean;
}

/**
 * DetailsModal - Pop-up di visualizzazione/dettaglio.
 * Design Standard: Mirroring di NewAppointmentModal (Width, Padding, Gap).
 */
const DetailsModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  appointmentId,
  isImpegno = false,
}: DetailsModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isImpegno ? 'Dettagli Impegno' : 'Dettagli Appuntamento'}
    >
      <div className="mt-2">
        <AppointmentForm
          appointmentId={appointmentId}
          initialMode="view"
          defaultIsImpegno={isImpegno}
          onSuccess={onSuccess}
          onCancel={onClose}
        />
      </div>
    </Modal>
  );
};

export default DetailsModal;
