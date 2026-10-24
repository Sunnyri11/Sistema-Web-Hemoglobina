# filename: generar_dataset.py
"""
Generador de datos sintéticos para el "arranque en frío" de Walle-HB.

- Como script:    python generar_dataset.py   -> escribe nivel_hemoglobina_train.csv
- Como librería:  from generar_dataset import generar_dataframe
  (entrenamiento.py lo usa si el CSV no existe en Render).

Los rangos valor_min / valor_max varían (como en los datos reales, donde dependen
de la altitud y la edad) para que el modelo aprenda la REGLA "Hb frente a su rango"
y no memorice un único rango fijo.
"""
import random

import pandas as pd

ALTITUDES = [400, 2558, 3640, 3735, 4060, 4150]
COLUMNAS = [
    "id_genero", "altitud", "edad",
    "valor_min", "valor_max", "valor_hemoglobina", "estado_diagnostico",
]


def generar_dataframe(n=600, semilla=None):
    rng = random.Random(semilla)
    filas = []
    for _ in range(n):
        genero = rng.choice([1, 2])
        base_min, base_max = (14.0, 18.0) if genero == 1 else (12.0, 16.0)

        # Ajuste por altitud / edad: desplaza el rango de referencia
        ajuste = round(rng.uniform(0.0, 3.5), 1)
        vmin = round(base_min + ajuste, 1)
        vmax = round(base_max + ajuste + rng.choice([0.0, 0.5, 1.0]), 1)

        edad = rng.randint(1, 80)
        altitud = rng.choice(ALTITUDES)
        estado = rng.choice(["Anemia", "Estable", "Poliglobulia"])

        # ~40% de los casos caen pegados a un límite del rango (±0.3 g/dL): es
        # donde un modelo se equivoca más y donde más importa acertar.
        cerca = rng.random() < 0.4
        if estado == "Anemia":
            hb = vmin - (rng.uniform(0.01, 0.3) if cerca else rng.uniform(0.1, 5))
        elif estado == "Poliglobulia":
            hb = vmax + (rng.uniform(0.01, 0.3) if cerca else rng.uniform(0.1, 5))
        elif cerca:
            hb = vmin + rng.uniform(0, 0.3) if rng.random() < 0.5 else vmax - rng.uniform(0, 0.3)
        else:
            hb = rng.uniform(vmin, vmax)
        hb = round(hb, 2)

        filas.append([genero, altitud, edad, vmin, vmax, hb, estado])

    return pd.DataFrame(filas, columns=COLUMNAS)


if __name__ == "__main__":
    df = generar_dataframe(3000)
    df.to_csv("nivel_hemoglobina_train.csv", index=False)
    print(f"CSV generado correctamente ({len(df)} filas).")
