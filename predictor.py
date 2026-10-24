# filename: predictor.py
"""
Motor predictivo de Walle-HB. A partir del ÚLTIMO DATO y del HISTORIAL predice:

  1. Estado actual (modelo de aprendizaje automático + red de seguridad clínica).
  2. Valor de Hb proyectado al próximo control (regresión con fechas reales,
     dando más peso a los análisis recientes).
  3. Estado proyectado (el mismo modelo clasifica el valor proyectado).
  4. Tendencia, gravedad, riesgo (Bajo / Medio / Alto) y confianza.
  5. Días estimados hasta salir del rango (si está bien) o hasta normalizarse (si no).
  6. Próximo control sugerido, alertas y recomendaciones específicas
     (según estado, gravedad, tendencia, altitud, edad y riesgo).

Las proyecciones son ORIENTATIVAS y no reemplazan el criterio médico.
"""
from datetime import date

import numpy as np
import pandas as pd

from entrenamiento import construir_features, entrenar_modelo, obtener_modelo

DIAS_SUPUESTOS_ENTRE_CONTROLES = 30.0   # si C# no envía fechas
MIN_DIAS_PARA_PROYECTAR = 7             # menos separación = ruido, no tendencia
MAX_CAMBIO_PROYECTADO = 3.0             # tope de cambio en un horizonte (g/dL)
NIVELES_CONFIANZA = ["baja", "media", "alta"]


class ModeloNoDisponible(Exception):
    pass


# ---------------------------------------------------------------------------
# Clasificación (aprendizaje automático)
# ---------------------------------------------------------------------------
def _modelo():
    """Se obtiene en cada petición (no al importar): siempre el último
    entrenado/descargado y no revienta si aún no existe."""
    modelo = obtener_modelo()
    if modelo is None:
        entrenar_modelo()
        modelo = obtener_modelo()
    if modelo is None:
        raise ModeloNoDisponible("Walle-HB aún no tiene un modelo entrenado.")
    return modelo


def estado_por_rango(valor, v_min, v_max):
    if valor < v_min:
        return "Anemia"
    if valor > v_max:
        return "Poliglobulia"
    return "Estable"


def _clasificar(id_genero, altitud, edad, v_min, v_max, valor):
    fila = pd.DataFrame([{
        "id_genero": id_genero, "altitud": altitud, "edad": edad,
        "valor_min": v_min, "valor_max": v_max, "valor_hemoglobina": valor,
    }])
    estado_ia = str(_modelo().predict(construir_features(fila))[0])
    # Red de seguridad clínica: si la IA contradijera el rango de referencia,
    # prevalece el rango.
    estado = estado_por_rango(valor, v_min, v_max)
    if estado_ia != estado:
        print(f"⚠️ La IA dijo '{estado_ia}' pero el rango indica '{estado}'. Se usa el rango.")
    return estado


# ---------------------------------------------------------------------------
# Proyección de la curva
# ---------------------------------------------------------------------------
def _parsear_fecha(texto):
    try:
        return date.fromisoformat(str(texto)[:10])
    except Exception:
        return None


def _analizar_curva(serie):
    """serie: [(fecha|None, valor)] en orden cronológico (antiguo -> reciente)."""
    n = len(serie)
    fechas_reales = n >= 2 and all(f is not None for f, _ in serie)
    y = np.array([v for _, v in serie], dtype=float)
    if fechas_reales:
        base = serie[0][0]
        t = np.array([(f - base).days for f, _ in serie], dtype=float)
    else:
        t = np.arange(n, dtype=float) * DIAS_SUPUESTOS_ENTRE_CONTROLES

    info = {"n": n, "fechas_reales": fechas_reales, "suficiente": False,
            "pendiente_dia": 0.0, "residuo": 0.0, "r2": 0.0, "horizonte": 30,
            "variabilidad": float(np.std(y)) if n else 0.0}
    if n < 2 or len(set(t)) < 2 or (t[-1] - t[0]) < MIN_DIAS_PARA_PROYECTAR:
        return info

    # Más peso a lo reciente (vida media ~4 meses)
    pesos = np.exp(-(t[-1] - t) / 180.0)
    pendiente, intercepto = np.polyfit(t, y, 1, w=np.sqrt(pesos))
    ajuste = pendiente * t + intercepto
    ss_res = float(np.sum((y - ajuste) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))

    if fechas_reales:
        huecos = np.diff(sorted(set(t)))
        horizonte = int(np.clip(np.median(huecos), 14, 60))
    else:
        horizonte = 30

    info.update(suficiente=True, pendiente_dia=float(pendiente),
                residuo=float(np.std(y - ajuste)),
                r2=(1 - ss_res / ss_tot) if ss_tot > 1e-9 else 1.0,
                horizonte=horizonte)
    return info


def _confianza(curva):
    if not curva["suficiente"]:
        return "baja"
    n = curva["n"]
    nivel = 0 if n < 3 else (1 if n < 5 else 2)
    if curva["residuo"] > 1.0:        # datos muy dispersos
        nivel -= 1
    if not curva["fechas_reales"]:    # sin fechas, el tiempo es supuesto
        nivel -= 1
    return NIVELES_CONFIANZA[max(nivel, 0)]


def _gravedad(valor, v_min, v_max):
    desv = max(v_min - valor, valor - v_max, 0.0)
    if desv <= 0:
        return "ninguna", 0.0
    if desv < 1.0:
        return "leve", desv
    if desv < 2.5:
        return "moderada", desv
    return "severa", desv


def _riesgo(estado, desv, estado_proy, desv_proy, margen, confianza, suficiente):
    puntos = {"Estable": 0}.get(estado)
    if puntos is None:
        puntos = 1 if desv < 1.0 else (2 if desv < 2.5 else 3)
    elif margen is not None and margen < 0.5:
        puntos += 1                                   # al borde del rango

    if suficiente and confianza != "baja":
        if estado == "Estable" and estado_proy != "Estable":
            puntos += 2                               # se proyecta una salida del rango
        elif estado != "Estable":
            if desv_proy > desv + 0.3:
                puntos += 1                           # empeorando
            elif estado_proy == "Estable" or desv_proy < desv - 0.3:
                puntos -= 1                           # mejorando
    return "Alto" if puntos >= 3 else ("Medio" if puntos >= 1 else "Bajo")


# ---------------------------------------------------------------------------
# Textos
# ---------------------------------------------------------------------------
TEXTOS_PREDICTIVOS = {
    "recaida_anemia": "⚠️ Proyección Crítica (Walle-HB): Aunque tu estado actual está en rango, la velocidad de caída de tus niveles proyecta un alto riesgo de recaer en Anemia en tu próximo control si no intervienes.",
    "recaida_poliglobulia": "⚠️ Alerta de Alza Rápida (Walle-HB): Se detecta una curva empinada hacia el alza. El sistema proyecta una tendencia de riesgo hacia la Poliglobulia. Es urgente aumentar tu hidratación.",
    "mejora_sostenida": "📈 Tendencia Favorable (Walle-HB): La curva analítica muestra una estabilización progresiva hacia rangos óptimos. Tu cuerpo consolida una excelente adaptación de transporte de oxígeno.",
    "homeostasis": "🔄 Homeostasis Predictiva: Walle-HB confirma que la variabilidad de tus datos históricos es mínima. Tu metabolismo mantiene un control idóneo y una estabilidad sostenida en el tiempo.",
    "primer_analisis": "📊 Historial inicial en proceso. A partir de tu siguiente control clínico, el motor estadístico de Walle-HB comenzará a trazar proyecciones y tendencias personalizadas.",
    "pocos_dias": "📊 Tus análisis están muy juntos en el tiempo. Walle-HB necesita al menos una semana de separación entre controles para proyectar tu evolución con sentido.",
    "anemia_mejora": "📈 Evolución Positiva: A pesar del rango actual de Anemia, el algoritmo detecta una recuperación sostenida de la curva en los últimos registros.",
    "anemia_estancada": "📉 Alerta Estacionaria: La tendencia se mantiene estancada o en descenso en niveles bajos. Se sugiere evaluar la adherencia al tratamiento.",
    "poli_baja": "📉 Tendencia de Control: Los niveles están descendiendo paulatinamente hacia rangos seguros, mostrando efectividad en los hábitos de descompresión o hidratación.",
    "poli_sube": "🔺 Curva Ascendente Crítica: La viscosidad sanguínea proyecta un aumento sostenido. Evitar esfuerzos extenuantes y consultar a tu médico.",
}

RECOMENDACIONES_TENDENCIA = {
    "riesgo_caida": [
        "• Modificar dieta proactivamente: añadir legumbres y vegetales de hoja verde oscura para frenar la tendencia de descenso.",
        "• Planificar un control de ferritina preventivo antes de la fecha estándar de tu próximo análisis.",
    ],
    "riesgo_alza": [
        "• Reducir carnes rojas y alimentos muy ricos en hierro durante las siguientes 2 semanas.",
        "• Incrementar la ingesta de agua a unos 3 litros diarios para diluir preventivamente la concentración de glóbulos rojos.",
    ],
    "estable": [
        "• Mantener el patrón actual de nutrición y los hábitos físicos que estabilizaron tu curva biológica.",
    ],
}

RECOMENDACIONES_SALUD = {
    "Anemia": [
        "• Priorizar hierro hemínico (carnes magras, hígado) junto con jugos cítricos (vitamina C) para acelerar la absorción.",
        "• Monitorear síntomas de fatiga, palidez o debilidad muscular durante tus actividades diarias en altitud.",
    ],
    "Poliglobulia": [
        "• Incrementar el consumo de agua a unos 2.5 litros diarios para disminuir la viscosidad de la sangre.",
        "• Evitar suplementos vitamínicos con hierro o ácido fólico salvo indicación médica.",
    ],
    "Estable": [
        "• Mantener tu patrón alimenticio actual para conservar tu capacidad de transporte de oxígeno.",
        "• Continuar con actividad física moderada para aprovechar la buena oxigenación actual de tus tejidos.",
    ],
}

RECOMENDACIONES_GRAVEDAD = {
    ("Anemia", "leve"): ["• Repite el análisis en 2 a 4 semanas para confirmar si la tendencia persiste."],
    ("Anemia", "moderada"): ["• Pide un control con tu médico en los próximos días (ferritina, B12 y folato ayudan a encontrar la causa)."],
    ("Anemia", "severa"): ["• Tu nivel está muy por debajo del rango: consulta a tu médico pronto; no esperes al próximo control programado."],
    ("Poliglobulia", "leve"): ["• Repite el análisis en 2 a 4 semanas, bien hidratado, para confirmar el valor."],
    ("Poliglobulia", "moderada"): ["• Consulta con tu médico y repite el análisis en 1 a 2 semanas."],
    ("Poliglobulia", "severa"): ["• Tu nivel está muy por encima del rango: consulta a tu médico pronto y evita la deshidratación y el tabaco."],
}


def _recomendaciones(estado, gravedad, riesgo, tendencia, curva, confianza,
                     altitud, edad, proximo_control, msg_clave):
    if msg_clave in ("recaida_anemia", "recaida_poliglobulia"):
        recs = []   # hoy está en rango pero se proyecta una salida: no decir "mantén todo igual"
    else:
        recs = list(RECOMENDACIONES_SALUD.get(estado, RECOMENDACIONES_SALUD["Estable"]))
    recs += RECOMENDACIONES_GRAVEDAD.get((estado, gravedad), [])

    if msg_clave == "recaida_anemia":
        recs += RECOMENDACIONES_TENDENCIA["riesgo_caida"]
    elif msg_clave == "recaida_poliglobulia":
        recs += RECOMENDACIONES_TENDENCIA["riesgo_alza"]
    elif estado == "Estable" and curva["suficiente"]:
        recs += RECOMENDACIONES_TENDENCIA["estable"]

    if riesgo == "Alto":
        recs.append("• Riesgo alto: no esperes al próximo control, consulta con tu médico.")
    if altitud >= 2500:
        recs.append(f"• Vives a {int(altitud)} m: la altitud eleva la hemoglobina de forma natural; interpreta tus valores con el rango ajustado a tu altitud.")
    if edad < 18:
        recs.append("• Por tu edad, confirma siempre estos valores con tu médico tratante.")
    elif edad >= 60:
        recs.append("• Conviene valorar con tu médico un control más frecuente de tu hemoglobina.")
    if confianza == "baja":
        recs.append("• Con pocos análisis la proyección es solo orientativa: registra tus controles con regularidad para afinarla.")
    recs.append(f"• Próximo control sugerido: en unos {proximo_control} días.")

    vistos, unicas = set(), []
    for r in recs:                     # sin repetidos, conservando el orden
        if r not in vistos:
            vistos.add(r)
            unicas.append(r)
    return unicas


# ---------------------------------------------------------------------------
# Función principal
# ---------------------------------------------------------------------------
def generar_prediccion_y_recomendaciones(datos_paciente, serie):
    """
    datos_paciente: [id_genero, altitud, edad, valor_min, valor_max, valor_hemoglobina]
                    (valor_min / valor_max / valor_hemoglobina = ÚLTIMO DATO)
    serie: HISTORIAL, lista de dicts {"fecha": "yyyy-MM-dd" | None, "valor_hemoglobina": float}
           ordenada del más nuevo al más antiguo (incluye el último dato).

    Devuelve (estado, [alerta], recomendaciones, prediccion_dict).
    """
    id_genero, altitud, edad, v_min, v_max, valor_actual = datos_paciente
    v_min, v_max = float(v_min), float(v_max)
    valor_actual = round(float(valor_actual), 2)
    altitud, edad = float(altitud), int(edad)

    # 1) Estado actual (ML)
    estado = _clasificar(id_genero, altitud, edad, v_min, v_max, valor_actual)
    gravedad, desv = _gravedad(valor_actual, v_min, v_max)
    margen = (min(valor_actual - v_min, v_max - valor_actual) if gravedad == "ninguna" else -desv)

    # 2) Curva (cronológica: antiguo -> reciente)
    cronologica = [(_parsear_fecha(r.get("fecha")), round(float(r["valor_hemoglobina"]), 2))
                   for r in reversed(serie)]
    curva = _analizar_curva(cronologica)
    confianza = _confianza(curva)
    horizonte = curva["horizonte"]

    # 3) Proyección
    if curva["suficiente"]:
        cambio = float(np.clip(curva["pendiente_dia"] * horizonte,
                               -MAX_CAMBIO_PROYECTADO, MAX_CAMBIO_PROYECTADO))
        valor_proy = round(float(np.clip(valor_actual + cambio, 3.0, 25.0)), 2)
        cambio = round(valor_proy - valor_actual, 2)
        tendencia = "ascendente" if cambio > 0.2 else ("descendente" if cambio < -0.2 else "estable")
        estado_proy = _clasificar(id_genero, altitud, edad, v_min, v_max, valor_proy)
    else:
        cambio, valor_proy, estado_proy = 0.0, valor_actual, estado
        tendencia = "sin_datos"
    _, desv_proy = _gravedad(valor_proy, v_min, v_max)

    # 4) Días hasta salir del rango / normalizarse
    pend = curva["pendiente_dia"]
    dias_salir = dias_normalizar = None
    if curva["suficiente"] and confianza != "baja" and abs(pend) > 1e-6:
        if gravedad == "ninguna":
            dias = ((valor_actual - v_min) / -pend) if pend < 0 else ((v_max - valor_actual) / pend)
            dias_salir = int(round(dias)) if dias <= 365 else None
        else:
            if estado == "Anemia" and pend > 0:
                dias = (v_min - valor_actual) / pend
            elif estado == "Poliglobulia" and pend < 0:
                dias = (valor_actual - v_max) / -pend
            else:
                dias = None
            dias_normalizar = int(round(dias)) if dias is not None and dias <= 365 else None

    riesgo = _riesgo(estado, desv, estado_proy, desv_proy,
                     margen if gravedad == "ninguna" else None, confianza, curva["suficiente"])
    proximo_control = {"Alto": 14, "Medio": 21}.get(riesgo, min(horizonte, 60))

    # 5) Mensaje evolutivo
    clave = "primer_analisis"
    if curva["n"] >= 2 and not curva["suficiente"]:
        clave = "pocos_dias"
    elif curva["suficiente"]:
        if estado == "Estable":
            if cambio < -0.4 or estado_proy == "Anemia":
                clave = "recaida_anemia"
            elif cambio > 0.4 or estado_proy == "Poliglobulia":
                clave = "recaida_poliglobulia"
            else:
                clave = "homeostasis" if curva["variabilidad"] < 0.3 else "mejora_sostenida"
        elif estado == "Anemia":
            clave = "anemia_mejora" if cambio > 0.2 else "anemia_estancada"
        else:
            clave = "poli_baja" if cambio < -0.2 else "poli_sube"

    if curva["suficiente"]:
        proyeccion_txt = (f"🔮 Proyección a {horizonte} días: ≈ {valor_proy:.1f} g/dL ({estado_proy}). "
                          f"Riesgo {riesgo.lower()}. Confianza {confianza} ({curva['n']} análisis).")
    else:
        proyeccion_txt = "🔮 Aún no hay datos suficientes para proyectar tu evolución (confianza baja)."

    alerta = (f"Reporte de Walle-HB: Tu estado actual es clasificado como {estado} con {valor_actual} g/dL.\n\n"
              f"{TEXTOS_PREDICTIVOS.get(clave)}\n\n{proyeccion_txt}")

    recomendaciones = _recomendaciones(estado, gravedad, riesgo, tendencia, curva, confianza,
                                       altitud, edad, proximo_control, clave)

    prediccion = {
        "valor_actual": valor_actual,
        "valor_proyectado": round(float(valor_proy), 2),
        "horizonte_dias": int(horizonte),
        "estado_proyectado": str(estado_proy),
        "tendencia": tendencia,
        "cambio_esperado": round(float(cambio), 2),
        "riesgo": riesgo,
        "gravedad": gravedad,
        "margen_al_limite": round(float(margen), 2),
        "dias_hasta_salir_rango": dias_salir,
        "dias_hasta_normalizar": dias_normalizar,
        "proximo_control_dias": int(proximo_control),
        "confianza": confianza,
        "puntos_usados": int(curva["n"]),
        "fechas_reales": bool(curva["fechas_reales"]),
        "rango_referencia": [v_min, v_max],
    }
    return str(estado), [alerta], recomendaciones, prediccion
