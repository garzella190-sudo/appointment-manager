'use client'

import { useCallback, useEffect, useRef } from 'react'

/** Quanto bisogna restare fermi (mouse) o tenere premuto (dito) prima dell'anteprima */
const RITARDO_MS = 3000
/** Movimento (px) oltre il quale non si sta più "stazionando" */
const TOLLERANZA_PX = 8
/** Su mobile l'anteprima resta visibile un attimo anche dopo aver sollevato il dito */
const DOPO_RILASCIO_MS = 2500

type GestoriAnteprima = {
  // Mouse (desktop)
  onPointerEnter: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerLeave: () => void
  onPointerDown: () => void
  // Touch (mobile/tablet): pressione prolungata, senza toccare gli eventi pointer di dnd-kit
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: () => void
  onTouchCancel: () => void
  onContextMenu: (e: React.MouseEvent) => void
  /** true (una sola volta) se il click va ignorato perché è la fine di un long-press */
  consumaClick: () => boolean
}

interface OpzioniAnteprima {
  /** Se false (es. drag in corso) il timer non parte */
  attivo?: boolean
  ritardo?: number
  /** Chiamata quando l'anteprima deve chiudersi */
  onChiudi?: () => void
}

/**
 * Anteprima rapida:
 * - **desktop**: si apre dopo 3s di sosta del mouse e si chiude al primo movimento;
 * - **mobile**: si apre tenendo premuto 3s sulla card e si chiude ~2,5s dopo il rilascio
 *   (o subito se si scorre). Gli eventi touch sono separati da quelli pointer, così il
 *   drag&drop di dnd-kit su desktop resta intatto.
 */
export function useHoverApriScheda(
  onApri: (elemento: HTMLElement) => void,
  { attivo = true, ritardo = RITARDO_MS, onChiudi }: OpzioniAnteprima = {},
): GestoriAnteprima {
  const timer = useRef<number | null>(null)
  const timerChiusura = useRef<number | null>(null)
  const posizione = useRef<{ x: number; y: number } | null>(null)
  const elemento = useRef<HTMLElement | null>(null)
  const aperta = useRef(false)
  const origine = useRef<'mouse' | 'touch' | null>(null)
  /** Se true, il prossimo click è la fine di un long-press: va ignorato */
  const clickDaIgnorare = useRef(false)

  const annullaTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const annullaChiusura = useCallback(() => {
    if (timerChiusura.current !== null) {
      window.clearTimeout(timerChiusura.current)
      timerChiusura.current = null
    }
  }, [])

  const programma = useCallback(() => {
    annullaTimer()
    timer.current = window.setTimeout(() => {
      timer.current = null
      aperta.current = true
      // Long-press: il click che arriva al rilascio non deve aprire la scheda completa
      if (origine.current === 'touch') clickDaIgnorare.current = true
      if (elemento.current) onApri(elemento.current)
    }, ritardo)
  }, [annullaTimer, onApri, ritardo])

  const chiudi = useCallback(() => {
    annullaTimer()
    annullaChiusura()
    posizione.current = null
    aperta.current = false
    onChiudi?.()
  }, [annullaTimer, annullaChiusura, onChiudi])

  /** Chiusura morbida dopo il rilascio del dito */
  const chiudiDopoRilascio = useCallback(() => {
    annullaTimer()
    if (!aperta.current) return
    annullaChiusura()
    timerChiusura.current = window.setTimeout(() => {
      timerChiusura.current = null
      chiudi()
    }, DOPO_RILASCIO_MS)
  }, [annullaTimer, annullaChiusura, chiudi])

  // Drag in corso o componente disattivato: niente anteprima
  useEffect(() => {
    if (!attivo) chiudi()
  }, [attivo, chiudi])

  useEffect(
    () => () => {
      annullaTimer()
      annullaChiusura()
    },
    [annullaTimer, annullaChiusura],
  )

  return {
    // ── Mouse ────────────────────────────────────────────────────────────
    onPointerEnter: (e) => {
      if (!attivo || e.pointerType !== 'mouse') return
      origine.current = 'mouse'
      elemento.current = e.currentTarget as HTMLElement
      posizione.current = { x: e.clientX, y: e.clientY }
      programma()
    },
    onPointerMove: (e) => {
      if (!attivo || e.pointerType !== 'mouse' || !posizione.current) return
      const dx = e.clientX - posizione.current.x
      const dy = e.clientY - posizione.current.y
      if (Math.hypot(dx, dy) > TOLLERANZA_PX) {
        posizione.current = { x: e.clientX, y: e.clientY }
        chiudi()
        programma()
      }
    },
    onPointerLeave: chiudi,
    onPointerDown: chiudi,

    // ── Touch ────────────────────────────────────────────────────────────
    onTouchStart: (e) => {
      if (!attivo) return
      const dito = e.touches[0]
      if (!dito) return
      origine.current = 'touch'
      clickDaIgnorare.current = false
      elemento.current = e.currentTarget as HTMLElement
      posizione.current = { x: dito.clientX, y: dito.clientY }
      programma()
    },
    onTouchMove: (e) => {
      if (!attivo || !posizione.current) return
      const dito = e.touches[0]
      if (!dito) return
      const dx = dito.clientX - posizione.current.x
      const dy = dito.clientY - posizione.current.y
      if (Math.hypot(dx, dy) > TOLLERANZA_PX) {
        // Sta scorrendo: nessuna anteprima
        annullaTimer()
        posizione.current = null
      }
    },
    onTouchEnd: chiudiDopoRilascio,
    onTouchCancel: chiudiDopoRilascio,

    // Evita il menu "copia/condividi" del long-press del browser
    onContextMenu: (e) => {
      if (aperta.current || timer.current !== null) e.preventDefault()
    },

    consumaClick: () => {
      if (!clickDaIgnorare.current) return false
      clickDaIgnorare.current = false
      return true
    },
  }
}
