"""
Scambia le righe delle due tabelle settimanali e salva PNG + PDF.

  LUNEDI  <-> MARTEDI   (contenuti)
  MERCOLEDI <-> GIOVEDI (contenuti)

Le etichette dei giorni restano al loro posto. Il lavoro e' fatto ritagliando e
ricomponendo le bande dell'immagine originale: testi, font, colori ed evidenziati
restano quelli del documento, senza riscrivere nulla a mano.
"""
import os
import numpy as np
from PIL import Image

USCITA = "tabelle_dieta"

LAVORI = [
    {
        "nome": "1825",
        "sorgente": r"C:\Users\garze\.dsh\attachments\v1\objects\be\be18c4f260f4ff94e350d5f3a49cab3490e0ef9589e6d6e6cb11baf156ade80d",
        "orizzontali": [796, 827, 1007, 1217, 1397, 1606, 1786, 1965, 2175],
        "testo_da": 233,
        "testo_a": 1172,
        "tabella_da": 116,
        "tabella_a": 1173,
    },
    {
        "nome": "claudia",
        "sorgente": r"C:\Users\garze\.dsh\attachments\v1\objects\55\559b07ed1ef9c387dbf1d9aa30269daaa69f797d3157f90470e67dba2bf2bf66",
        "orizzontali": [731, 767, 971, 1209, 1413, 1650, 1854, 2058, 2296],
        "testo_da": 173,
        "testo_a": 1233,
        "tabella_da": 40,
        "tabella_a": 1234,
    },
]

SCAMBI = [(0, 1), (2, 3)]  # LUN<->MAR, MER<->GIO


def zona_pagina(a):
    """La parte chiara piu' alta dell'immagine: esclude le barre nere del telefono."""
    lumin = a.mean(axis=(1, 2))
    chiare = np.where(lumin > 150)[0]
    if len(chiare) == 0:
        return 0, a.shape[0] - 1
    blocchi, inizio, prec = [], chiare[0], chiare[0]
    for i in chiare[1:]:
        if i - prec <= 8:
            prec = i
            continue
        blocchi.append((int(inizio), int(prec)))
        inizio = prec = i
    blocchi.append((int(inizio), int(prec)))
    return max(blocchi, key=lambda b: b[1] - b[0])


def fondo_contenuto(a, da, a_):
    """Ultima riga con qualcosa scritto: serve per tenere anche le note finali."""
    scuro = a.mean(axis=2) < 200
    righe = np.where(scuro.any(axis=1))[0]
    righe = righe[(righe >= da) & (righe <= a_)]
    return int(righe.max()) if len(righe) else a_


def elabora(lav):
    img = Image.open(lav["sorgente"]).convert("RGB")
    a = np.asarray(img)
    linee = lav["orizzontali"]
    x_da, x_a = lav["testo_da"], lav["testo_a"]

    bande = {
        i: img.crop((x_da, linee[i + 1] + 1, x_a, linee[i + 2]))
        for i in range(7)
    }

    risultato = img.copy()
    larghezza = x_a - x_da
    for primo, secondo in SCAMBI:
        riquadro_primo = (x_da, linee[primo + 1] + 1, x_a, linee[primo + 2])
        riquadro_secondo = (x_da, linee[secondo + 1] + 1, x_a, linee[secondo + 2])
        altezza_primo = riquadro_primo[3] - riquadro_primo[1]
        altezza_secondo = riquadro_secondo[3] - riquadro_secondo[1]

        # il menu del secondo va nel posto del primo e viceversa
        risultato.paste(
            bande[secondo].resize((larghezza, altezza_primo), Image.LANCZOS), riquadro_primo
        )
        risultato.paste(
            bande[primo].resize((larghezza, altezza_secondo), Image.LANCZOS), riquadro_secondo
        )

    # il fondo si cerca SOLO dentro la pagina bianca: sotto c'e' la barra nera del telefono
    _pagina_da, pagina_a = zona_pagina(a)
    fondo = fondo_contenuto(a, linee[-1], pagina_a)

    margine = 12
    finale = risultato.crop((
        lav["tabella_da"] - margine,
        linee[0] - margine,
        lav["tabella_a"] + margine,
        fondo + margine,
    ))

    os.makedirs(USCITA, exist_ok=True)
    png = os.path.join(USCITA, f"tabella_{lav['nome']}_scambiata.png")
    pdf = os.path.join(USCITA, f"tabella_{lav['nome']}_scambiata.pdf")
    finale.save(png)
    finale.save(pdf, "PDF", resolution=200.0)
    print(f"{lav['nome']}: {png} ({finale.size[0]}x{finale.size[1]}) + PDF")


for lav in LAVORI:
    elabora(lav)
