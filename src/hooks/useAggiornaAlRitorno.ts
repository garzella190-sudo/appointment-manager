'use client'

import { useEffect, useRef } from 'react'

interface OpzioniAggiornamento {
  /** Intervallo minimo tra due aggiornamenti automatici (ms) */
  intervalloMinimoMs?: number
}

/**
 * Esegue `callback` ogni volta che l'app PWA torna in primo piano
 * (riapertura dalla home, ripresa dal background, ritorno sulla scheda).
 *
 * Serve a mostrare i dati aggiornati senza che l'utente debba premere "Aggiorna":
 * le modifiche fatte da un altro dispositivo si vedono appena riapri l'app.
 * L'intervallo minimo evita raffiche di richieste se l'app viene aperta/ripresa
 * più volte in pochi secondi.
 */
export function useAggiornaAlRitorno(
  callback: () => void,
  { intervalloMinimoMs = 10_000 }: OpzioniAggiornamento = {},
) {
  const callbackRef = useRef(callback)
  const ultimoAggiornamento = useRef(0)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    const esegui = () => {
      if (document.visibilityState !== 'visible') return
      const adesso = Date.now()
      if (adesso - ultimoAggiornamento.current < intervalloMinimoMs) return
      ultimoAggiornamento.current = adesso
      callbackRef.current()
    }

    // "focus" copre il ritorno sulla finestra/scheda, "visibilitychange" la ripresa
    // della PWA dal background: insieme coprono desktop, mobile e iOS standalone.
    const suVisibilita = () => {
      if (document.visibilityState === 'visible') esegui()
    }

    // Segna il momento del mount: l'aggiornamento iniziale lo fa già la pagina
    ultimoAggiornamento.current = Date.now()

    document.addEventListener('visibilitychange', suVisibilita)
    window.addEventListener('focus', esegui)

    return () => {
      document.removeEventListener('visibilitychange', suVisibilita)
      window.removeEventListener('focus', esegui)
    }
  }, [intervalloMinimoMs])
}
