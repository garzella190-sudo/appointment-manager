'use client'

import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { CalendarDays, Clock, Car, IdCard, User, Phone, StickyNote } from 'lucide-react'
import type { Appointment } from '@/types'

interface AnteprimaAppuntamentoProps {
  apt: Appointment
  /** Rettangolo della card: il popup si posiziona accanto */
  rect: DOMRect
  onClose: () => void
}

const LARGHEZZA = 296
const MARGINE = 10

/**
 * Anteprima rapida (sola lettura) di un appuntamento: si apre da sola dopo 3 secondi
 * di sosta del mouse e scompare al movimento. Nessuna interazione, nessun pulsante:
 * `pointer-events-none` così non ruba mai il puntatore alla card sottostante.
 */
export function AnteprimaAppuntamento({ apt, rect, onClose }: AnteprimaAppuntamentoProps) {
  // Si chiude anche se la pagina scorre o cambia dimensione (posizione non più valida)
  useEffect(() => {
    const chiudi = () => onClose()
    window.addEventListener('scroll', chiudi, true)
    window.addEventListener('resize', chiudi)
    return () => {
      window.removeEventListener('scroll', chiudi, true)
      window.removeEventListener('resize', chiudi)
    }
  }, [onClose])

  const posizione = useMemo(() => {
    if (typeof window === 'undefined') return { left: rect.left, top: rect.top }

    let left = rect.right + MARGINE
    if (left + LARGHEZZA > window.innerWidth - MARGINE) {
      left = Math.max(MARGINE, rect.left - LARGHEZZA - MARGINE)
    }

    const altoStimato = 250
    let top = rect.top
    if (top + altoStimato > window.innerHeight - MARGINE) {
      top = Math.max(MARGINE, window.innerHeight - altoStimato - MARGINE)
    }

    return { left, top }
  }, [rect])

  const colore = apt.istruttore?.color || '#0ea5e9'
  const annullato = apt.stato === 'annullato'

  const quando = (() => {
    try {
      return format(parseISO(apt.appointment_date), 'EEEE d MMMM', { locale: it })
    } catch {
      return apt.appointment_date
    }
  })()

  return createPortal(
    <div
      role="tooltip"
      className="fixed z-[9999] pointer-events-none animate-fade-in"
      style={{ left: posizione.left, top: posizione.top, width: LARGHEZZA }}
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl shadow-zinc-900/20 overflow-hidden">
        {/* Intestazione cliente */}
        <div className="px-3.5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2.5">
          <span
            className="w-1.5 h-9 rounded-full shrink-0"
            style={{ backgroundColor: colore }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-black text-zinc-900 dark:text-zinc-50 truncate">
              {apt.client_name || 'Senza nome'}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">
              {apt.istruttore?.name || 'Istruttore non assegnato'}
            </p>
          </div>
          <span
            className={
              'text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0 ' +
              (annullato
                ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400')
            }
          >
            {annullato ? 'Annullata' : 'Confermata'}
          </span>
        </div>

        {/* Dettagli */}
        <div className="px-3.5 py-2.5 space-y-1.5">
          <Riga icona={CalendarDays} testo={quando} />
          <Riga
            icona={Clock}
            testo={`${apt.appointment_time} · ${apt.duration} min`}
            forte
          />
          {(apt.license_type || apt.gearbox_type) && (
            <Riga
              icona={IdCard}
              testo={[apt.license_type, apt.gearbox_type].filter(Boolean).join(' · ')}
            />
          )}
          {apt.vehicle_id && <Riga icona={Car} testo={apt.vehicle_id} />}
          {apt.phone && <Riga icona={Phone} testo={apt.phone} />}
          {apt.tipo_impegno && <Riga icona={User} testo={apt.tipo_impegno} />}
        </div>

        {apt.notes && (
          <div className="px-3.5 pb-3">
            <div className="flex items-start gap-1.5 text-zinc-500 dark:text-zinc-400">
              <StickyNote size={11} className="mt-0.5 shrink-0" />
              <p className="text-[11px] leading-snug line-clamp-3">{apt.notes}</p>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

function Riga({
  icona: Icona,
  testo,
  forte = false,
}: {
  icona: React.ElementType
  testo: string
  forte?: boolean
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icona size={11} className="text-zinc-400 shrink-0" />
      <span
        className={
          'text-[11px] truncate ' +
          (forte
            ? 'font-black text-zinc-900 dark:text-zinc-100'
            : 'font-semibold text-zinc-600 dark:text-zinc-300')
        }
      >
        {testo}
      </span>
    </div>
  )
}
