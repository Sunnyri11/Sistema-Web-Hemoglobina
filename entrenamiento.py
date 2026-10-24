# filename: entrenamiento.py
"""
Aprendizaje automático de Walle-HB + ciclo de vida de su memoria (.pkl):

    entrenar  ->  guardar .pkl local  ->  subir a Aiven (walle_memory)
    despertar ->  bajar de Aiven      ->  cargar en memoria RAM
"""
import os
import threading

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split

import aiven
from aiven import COLUMNAS_BASE
from generar_dataset import generar_dataframe

RUTA_PKL = os.getenv("WALLE_PKL", "mini_ia_hemoglobina.pkl")
CSV_SINTETICO = "nivel_hemoglobina_train.csv"

# El modelo recibe las 6 columnas base + 2 derivadas: a cuántos g/dL está la Hb
# de su mínimo y de su máximo. Un árbol de decisión no sabe "restar" por sí solo,
# y sin estas columnas confundía p. ej. Hb 15.0 (mínimo 15.6) con "Estable".
FEATURES = COLUMNAS_BASE + ["dif_min", "dif_max"]

PESO_REAL = 10.0  # cada dato clínico real pesa 10 veces más que uno sintético

_lock_entrenamiento = threading.Lock()
_modelo_actual = None


# ---------------------------------------------------------------------------
# Utilidades de datos
# ---------------------------------------------------------------------------
def calcular_etiqueta(row):
    valor, v_min, v_max = row["valor_hemoglobina"], row["valor_min"], row["valor_max"]
    if pd.isna(valor) or pd.isna(v_min) or pd.isna(v_max):
        return "Estable"
    if valor < v_min:
        return "Anemia"
    if valor > v_max:
        return "Poliglobulia"
    return "Estable"


def construir_features(df):
    """DataFrame con las 6 columnas base -> matriz de 8 features del modelo."""
    X = df[COLUMNAS_BASE].astype(float).copy()
    X["dif_min"] = X["valor_hemoglobina"] - X["valor_min"]
    X["dif_max"] = X["valor_hemoglobina"] - X["valor_max"]
    return X[FEATURES]


def _preparar(df):
    """Limpia, quita duplicados y (re)calcula la etiqueta clínica."""
    columnas = COLUMNAS_BASE + ["estado_diagnostico"]
    if df is None or df.empty:
        return pd.DataFrame(columns=columnas)
    df = df[COLUMNAS_BASE].apply(pd.to_numeric, errors="coerce").dropna().round(2)
    df = df[
        (df["edad"] >= 0) & (df["edad"] <= 120)
        & (df["valor_min"] < df["valor_max"])
        & (df["valor_hemoglobina"] > 0)
    ].drop_duplicates()
    if df.empty:
        return pd.DataFrame(columns=columnas)
    df = df.copy()
    df["estado_diagnostico"] = df.apply(calcular_etiqueta, axis=1)
    return df


def _leer_sinteticos():
    try:
        df = pd.read_csv(CSV_SINTETICO)
    except Exception:
        df = generar_dataframe(600)  # el CSV no está desplegado: lo generamos
    return _preparar(df)


# ---------------------------------------------------------------------------
# Modelo en memoria RAM
# ---------------------------------------------------------------------------
def _modelo_valido(modelo):
    return hasattr(modelo, "predict") and getattr(modelo, "n_features_in_", None) == len(FEATURES)


def _leer_pkl(ruta):
    try:
        modelo = joblib.load(ruta)
    except Exception as e:
        print(f"⚠️ No se pudo leer '{ruta}': {e}")
        return None
    if not _modelo_valido(modelo):
        print(f"ℹ️ '{ruta}' es de una versión anterior del modelo (otras columnas); se reentrenará.")
        return None
    return modelo


def obtener_modelo():
    """Modelo activo (lo carga del .pkl local la primera vez). None si no hay."""
    global _modelo_actual
    if _modelo_actual is None and os.path.exists(RUTA_PKL):
        _modelo_actual = _leer_pkl(RUTA_PKL)
    return _modelo_actual


def recargar_modelo():
    global _modelo_actual
    _modelo_actual = _leer_pkl(RUTA_PKL) if os.path.exists(RUTA_PKL) else None
    return _modelo_actual is not None


# ---------------------------------------------------------------------------
# Memoria en Aiven (walle_memory)
# ---------------------------------------------------------------------------
def guardar_pkl_en_aiven():
    if not os.path.exists(RUTA_PKL):
        print(f"⚠️ No existe '{RUTA_PKL}' local para subir.")
        return False
    print("📤 Subiendo memoria binaria .pkl a walle_memory...")
    with open(RUTA_PKL, "rb") as f:
        datos = f.read()
    ok = aiven.guardar_memoria(datos)
    if ok:
        print(f"✅ Memoria guardada en walle_memory ({len(datos) / 1024:.0f} KB).")
    return ok


def cargar_pkl_desde_aiven():
    """Descarga la memoria de Aiven, la valida y la carga. False si no hay
    memoria, está dañada o es incompatible (entonces main.py reentrena)."""
    print("🌅 Descargando memoria desde walle_memory...")
    datos = aiven.cargar_memoria()
    if not datos:
        print("ℹ️ walle_memory vacía o inaccesible.")
        return False

    temporal = RUTA_PKL + ".descarga"
    with open(temporal, "wb") as f:
        f.write(datos)
    if _leer_pkl(temporal) is None:
        os.remove(temporal)
        return False
    os.replace(temporal, RUTA_PKL)
    recargar_modelo()
    print("🔄 Memoria restaurada desde Aiven.")
    return True


# ---------------------------------------------------------------------------
# Entrenamiento
# ---------------------------------------------------------------------------
def _nuevo_bosque():
    return RandomForestClassifier(n_estimators=50, random_state=42, n_jobs=1)


def _entrenar():
    global _modelo_actual

    reales = _preparar(aiven.leer_datos_reales())
    sinteticos = _leer_sinteticos()
    reales["peso"] = PESO_REAL
    sinteticos["peso"] = 1.0
    df = pd.concat([reales, sinteticos], ignore_index=True)

    X = construir_features(df)
    y = df["estado_diagnostico"]
    w = df["peso"]

    # 1) Evaluación honesta: se separa ANTES de ponderar (antes se duplicaban
    #    filas x100 y el mismo dato caía en train y en test, inflando la precisión).
    estratificar = y if y.value_counts().min() >= 2 else None
    X_tr, X_te, y_tr, y_te, w_tr, _ = train_test_split(
        X, y, w, test_size=0.20, random_state=42, stratify=estratificar
    )
    prueba = _nuevo_bosque().fit(X_tr, y_tr, sample_weight=w_tr)
    pred = prueba.predict(X_te)
    precision = float(accuracy_score(y_te, pred))
    reporte = classification_report(y_te, pred, zero_division=0)

    # 2) El modelo que se despliega aprende de TODOS los datos.
    modelo = _nuevo_bosque().fit(X, y, sample_weight=w)

    temporal = RUTA_PKL + ".tmp"
    joblib.dump(modelo, temporal, compress=3)
    os.replace(temporal, RUTA_PKL)  # reemplazo atómico: nunca queda un .pkl a medias
    _modelo_actual = modelo
    print(f"🧠 Modelo entrenado: {len(reales)} reales + {len(sinteticos)} sintéticos "
          f"| precisión en prueba {precision * 100:.1f}%")

    subido = guardar_pkl_en_aiven()
    return {
        "registros_reales": int(len(reales)),
        "registros_sinteticos": int(len(sinteticos)),
        "precision": round(precision, 4),
        "subido_a_aiven": subido,
        "reporte": reporte,
        "importancias": dict(zip(FEATURES, [round(float(i), 4) for i in modelo.feature_importances_])),
    }


def entrenar_modelo(bloquear=True):
    """Entrena, guarda el .pkl y lo sube a Aiven. Devuelve un dict con el
    resultado, o None si bloquear=False y ya hay otro entrenamiento en curso."""
    if not _lock_entrenamiento.acquire(blocking=bloquear):
        return None
    try:
        return _entrenar()
    finally:
        _lock_entrenamiento.release()


def registrar_y_aprender(filas):
    """Guarda las observaciones nuevas en Aiven y, SOLO si había algo nuevo,
    reentrena y sube la memoria actualizada. Devuelve cuántas eran nuevas."""
    for f in filas:
        f["estado_diagnostico"] = calcular_etiqueta(f)
    nuevas = aiven.registrar_observaciones(filas)
    if nuevas > 0:
        print(f"📚 {nuevas} observaciones nuevas: reentrenando...")
        entrenar_modelo(bloquear=False)
    return nuevas


if __name__ == "__main__":
    resultado = entrenar_modelo()
    print(resultado["reporte"])
