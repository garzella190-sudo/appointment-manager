'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface ScrollbarOrizzontaleProps {
  /** Contenitore scrollabile da controllare */
  targetRef: React.RefObject<HTMLElement | null>
  /** Cambiando questo valore si forza la rimisurazione (es. numero colonne/vista) */
  versione?: string | number
}

/**
 * Barra di scorrimento orizzontale SEMPRE visibile su desktop, fissa in fondo allo
 * schermo sotto la bottom nav (che è una pillola flottante, quindi resta libero lo
 * spazio più in basso).
 *
 * - niente barra nativa nascosta "a sorpresa": questa c'è sempre e si trascina col mouse;
 * - se non c'è nulla da scorrere il pollice occupa tutta la pista (si capisce subito);
 * - su mobile non viene mostrata (si scorre col dito).
 */
export function ScrollbarOrizzontale({ targetRef, versione = '' }: ScrollbarOrizzontaleProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [montato, setMontato] = useState(false)
  const [trascinando, setTrascinando] = useState(false)
  const [stato, setStato] = useState({ eccedenza: 0, rapporto: 1, posizione: 0 })

  useEffect(() => setMontato(true), [])

  const aggiorna = useCallback(() => {
    const el = targetRef.current
    if (!el) return
    const vista = el.clientWidth
    const contenuto = el.scrollWidth
    const eccedenza = Math.max(0, contenuto - vista)
    setStato({
      eccedenza,
      rapporto: vista > 0 ? Math.min(1, vista / Math.max(1, contenuto)) : 1,
      posizione: eccedenza > 0 ? el.scrollLeft / eccedenza : 0,
    })
  }, [targetRef])

  useEffect(() => {
    const el = targetRef.current
    if (!el) return

    aggiorna()
    // Rimisura dopo il primo layout (font/griglia) e a ogni cambio di vista
    const dopoLayout = window.setTimeout(aggiorna, 150)

    el.addEventListener('scroll', aggiorna, { passive: true })
    window.addEventListener('resize', aggiorna)

    const ro = new ResizeObserver(aggiorna)
    ro.observe(el)

    return () => {
      window.clearTimeout(dopoLayout)
      el.removeEventListener('scroll', aggiorna)
      window.removeEventListener('resize', aggiorna)
      ro.disconnect()
    }
  }, [targetRef, aggiorna, versione])

  const scorribile = stato.eccedenza > 4

  /** Trascinamento del pollice */
  const iniziaTrascinamento = (e: React.PointerEvent) => {
    const el = targetRef.current
    const track = trackRef.current
    if (!el || !track || !scorribile) return

    e.preventDefault()
    e.stopPropagation()
    setTrascinando(true)

    const larghezzaTrack = track.clientWidth
    const larghezzaPollice = larghezzaTrack * stato.rapporto
    const corsa = Math.max(1, larghezzaTrack - larghezzaPollice)
    const fattore = stato.eccedenza / corsa

    const partenzaX = e.clientX
    const partenzaScroll = el.scrollLeft

    const muovi = (ev: PointerEvent) => {
      el.scrollLeft = partenzaScroll + (ev.clientX - partenzaX) * fattore
    }

    const fine = () => {
      setTrascinando(false)
      window.removeEventListener('pointermove', muovi)
      window.removeEventListener('pointerup', fine)
      window.removeEventListener('pointercancel', fine)
    }

    window.addEventListener('pointermove', muovi)
    window.addEventListener('pointerup', fine)
    window.addEventListener('pointercancel', fine)
  }

  /** Click sulla pista: salto alla posizione */
  const clicPista = (e: React.PointerEvent) => {
    const el = targetRef.current
    const track = trackRef.current
    if (!el || !track || !scorribile || e.target !== track) return

    const rect = track.getBoundingClientRect()
    const larghezzaPollice = rect.width * stato.rapporto
    const corsa = Math.max(1, rect.width - larghezzaPollice)
    // centro del pollice nel punto cliccato
    const frazione = Math.max(0, Math.min(1, (e.clientX - rect.left - larghezzaPollice / 2) / corsa))
    el.scrollLeft = frazione * stato.eccedenza
  }

  if (!montato) return null

  const larghezzaPollice = Math.max(10, stato.rapporto * 100)
  const sinistraPollice = Math.max(0, Math.min(100 - larghezzaPollice, stato.posizione * (100 - larghezzaPollice)))

  return createPortal(
    <div
      className="fixed left-0 right-0 z-40 hidden md:block px-2"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)' }}
    >
      <div
        ref={trackRef}
        onPointerDown={clicPista}
        title={scorribile ? 'Trascina per scorrere' : 'Tutto visibile'}
        className={
          'relative h-4 rounded-full bg-zinc-300/80 dark:bg-zinc-700/70 shadow-inner ' +
          (scorribile ? 'cursor-pointer' : 'cursor-default opacity-70')
        }
      >
        <div
          onPointerDown={iniziaTrascinamento}
          className={
            'absolute top-0 h-full rounded-full transition-colors ' +
            (scorribile
              ? trascinando
                ? 'bg-zinc-600 dark:bg-zinc-300 cursor-grabbing'
                : 'bg-zinc-500 dark:bg-zinc-400 hover:bg-zinc-600 dark:hover:bg-zinc-300 cursor-grab'
              : 'bg-zinc-400/70 dark:bg-zinc-500/70 cursor-default')
          }
          style={{ width: `${larghezzaPollice}%`, left: `${sinistraPollice}%` }}
        />
      </div>
    </div>,
    document.body,
  )
}
