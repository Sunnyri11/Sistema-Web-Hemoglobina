# filename: aiven.py
"""
Todo el acceso a la base de datos Aiven (MySQL) de Walle-HB en un solo lugar.

Tablas que usa:
  - walle_memory      : la "memoria" de la IA (el .pkl completo en un LONGBLOB).
  - walle_aprendizaje : cada análisis que C# envía (historial + último dato), sin
                        duplicados, para que la IA siga aprendiendo aunque Render
                        borre su disco (el plan gratis es efímero).
  - nivel_hemoglobina y relacionadas (solo lectura, las llena tu backend C#).

Configuración (recomendado en Render -> Environment):
  DATABASE_URL  = mysql+pymysql://usuario:clave@host:puerto/base
  (o bien AIVEN_USER / AIVEN_PASSWORD / AIVEN_HOST / AIVEN_PORT / AIVEN_DB)
Si no defines nada, se usan los valores que ya tenías.
"""
import hashlib
import os
from datetime import datetime
from urllib.parse import quote_plus

import pandas as pd
from sqlalchemy import (
    Column, DateTime, Integer, LargeBinary, MetaData, Numeric, String, Table,
    create_engine, delete, insert, select, text,
)
from sqlalchemy.dialects.mysql import LONGBLOB

COLUMNAS_BASE = [
    "id_genero", "altitud", "edad", "valor_min", "valor_max", "valor_hemoglobina",
]
CSV_CACHE = "nivel_hemoglobina.csv"

CONSULTA_ENTRENAMIENTO = """
    SELECT
        p.id_genero AS id_genero,
        c.altitud AS altitud,
        (YEAR(CURDATE()) - YEAR(fn.fecha_de_nacimiento))
            - (RIGHT(CURDATE(), 5) < RIGHT(fn.fecha_de_nacimiento, 5)) AS edad,
        rh.valor_min AS valor_min,
        rh.valor_max AS valor_max,
        nh.valor_hemoglobina AS valor_hemoglobina
    FROM nivel_hemoglobina nh
    INNER JOIN usuario u ON nh.id_usuario = u.id_usuario
    INNER JOIN persona p ON u.id_persona = p.id_persona
    INNER JOIN ciudad c ON p.id_ciudad = c.id_ciudad
    INNER JOIN rango_hemoglobina rh ON nh.id_rango_hemoglobina = rh.id_rango
    INNER JOIN fecha_nacimiento fn ON p.id_fecha_nacimiento = fn.id_fecha_nacimiento
"""

# ---------------------------------------------------------------------------
# Conexión
# ---------------------------------------------------------------------------
def _url_conexion():
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    usuario = os.getenv("AIVEN_USER", "avnadmin")
    # ⚠️ Mueve esta clave a una variable de entorno en Render y rótala en Aiven:
    password = os.getenv("AIVEN_PASSWORD", "AVNS_RAotqvpMbH5nDsAc7GR")
    host = os.getenv("AIVEN_HOST", "mysql-1e7e449b-sistemahb.g" + ".aivencloud.com")
    puerto = os.getenv("AIVEN_PORT", "13585")
    base = os.getenv("AIVEN_DB", "sistemahb")
    return f"mysql+pymysql://{usuario}:{quote_plus(password)}@{host}:{puerto}/{base}"


_engine = None


def obtener_engine():
    """Un único engine con pool reutilizable (no uno nuevo por cada llamada)."""
    global _engine
    if _engine is None:
        url = _url_conexion()
        args = {}
        if url.startswith("mysql"):
            args = {"ssl": {"skip_verify": True}, "connect_timeout": 15}
        _engine = create_engine(
            url, connect_args=args, pool_pre_ping=True, pool_recycle=280
        )
    return _engine


# ---------------------------------------------------------------------------
# Tablas propias de Walle-HB
# ---------------------------------------------------------------------------
_metadata = MetaData()

walle_memory = Table(
    "walle_memory", _metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    # LONGBLOB: un BLOB normal solo admite 64 KB y un bosque de árboles lo supera.
    Column("memoria", LargeBinary().with_variant(LONGBLOB(), "mysql")),
)

walle_aprendizaje = Table(
    "walle_aprendizaje", _metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("huella", String(64), unique=True, nullable=False),
    Column("id_usuario", Integer),
    Column("fecha", String(20)),
    Column("id_genero", Integer, nullable=False),
    Column("altitud", Numeric(8, 2, asdecimal=False), nullable=False),
    Column("edad", Integer, nullable=False),
    Column("valor_min", Numeric(6, 2, asdecimal=False), nullable=False),
    Column("valor_max", Numeric(6, 2, asdecimal=False), nullable=False),
    Column("valor_hemoglobina", Numeric(6, 2, asdecimal=False), nullable=False),
    Column("estado_diagnostico", String(20)),
    Column("creado", DateTime, default=datetime.utcnow),
)

_tablas_listas = False


def asegurar_tablas():
    """Crea las tablas si no existen y garantiza que 'memoria' sea LONGBLOB."""
    global _tablas_listas
    if _tablas_listas:
        return
    engine = obtener_engine()
    _metadata.create_all(engine)  # checkfirst: no toca tablas que ya existen

    if engine.dialect.name == "mysql":
        try:
            with engine.begin() as con:
                tipo = con.execute(text(
                    "SELECT DATA_TYPE FROM information_schema.COLUMNS "
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'walle_memory' "
                    "AND COLUMN_NAME = 'memoria'"
                )).scalar()
                if tipo and str(tipo).lower() != "longblob":
                    con.execute(text("ALTER TABLE walle_memory MODIFY memoria LONGBLOB"))
                    print("🛠️ Columna walle_memory.memoria ampliada a LONGBLOB.")
        except Exception as e:
            print(f"⚠️ No se pudo verificar el tipo de walle_memory.memoria: {e}")
    _tablas_listas = True


# ---------------------------------------------------------------------------
# Memoria (.pkl binario)
# ---------------------------------------------------------------------------
def guardar_memoria(datos: bytes) -> bool:
    """Reemplaza la memoria maestra de forma ATÓMICA (DELETE + INSERT en una
    sola transacción; con TRUNCATE, que hace commit implícito, un fallo en el
    INSERT dejaba la tabla vacía y se perdía todo lo aprendido)."""
    try:
        asegurar_tablas()
        with obtener_engine().begin() as con:
            con.execute(delete(walle_memory))
            con.execute(insert(walle_memory).values(memoria=datos))
        return True
    except Exception as e:
        print(f"⚠️ No se pudo guardar la memoria en walle_memory: {e}")
        return False


def cargar_memoria():
    """Devuelve los bytes del .pkl guardado, o None si no hay / falla."""
    try:
        asegurar_tablas()
        with obtener_engine().connect() as con:
            fila = con.execute(select(walle_memory.c.memoria).limit(1)).fetchone()
        if fila and fila[0]:
            return bytes(fila[0])
    except Exception as e:
        print(f"⚠️ No se pudo leer walle_memory: {e}")
    return None


# ---------------------------------------------------------------------------
# Aprendizaje: observaciones que llegan desde C#
# ---------------------------------------------------------------------------
def _huella(f):
    base = "|".join([
        str(f.get("id_usuario")), str(f.get("fecha")),
        f"{float(f['valor_hemoglobina']):.2f}",
        f"{float(f['valor_min']):.2f}", f"{float(f['valor_max']):.2f}",
    ])
    return hashlib.sha1(base.encode("utf-8")).hexdigest()


def registrar_observaciones(filas) -> int:
    """Guarda en walle_aprendizaje solo las observaciones NUEVAS.
    Devuelve cuántas se insertaron (0 = nada nuevo que aprender)."""
    if not filas:
        return 0
    try:
        asegurar_tablas()
        preparadas = {}
        for f in filas:
            preparadas[_huella(f)] = {
                "id_usuario": f.get("id_usuario"),
                "fecha": f.get("fecha"),
                "id_genero": int(f["id_genero"]),
                "altitud": round(float(f["altitud"]), 2),
                "edad": int(f["edad"]),
                "valor_min": round(float(f["valor_min"]), 2),
                "valor_max": round(float(f["valor_max"]), 2),
                "valor_hemoglobina": round(float(f["valor_hemoglobina"]), 2),
                "estado_diagnostico": f.get("estado_diagnostico"),
            }
        with obtener_engine().begin() as con:
            existentes = {
                r[0] for r in con.execute(
                    select(walle_aprendizaje.c.huella)
                    .where(walle_aprendizaje.c.huella.in_(list(preparadas)))
                )
            }
            nuevas = [{"huella": h, **v} for h, v in preparadas.items() if h not in existentes]
            if nuevas:
                con.execute(insert(walle_aprendizaje), nuevas)
        return len(nuevas)
    except Exception as e:
        print(f"⚠️ No se pudieron registrar las observaciones: {e}")
        return 0


def leer_datos_reales():
    """Datos clínicos reales = tabla nivel_hemoglobina (join) + walle_aprendizaje.
    Si Aiven no responde, usa la copia local nivel_hemoglobina.csv."""
    frames = []

    try:
        engine = obtener_engine()
        df = pd.read_sql(text(CONSULTA_ENTRENAMIENTO), engine)
        df.to_csv(CSV_CACHE, index=False)
        print(f"✅ {len(df)} registros leídos de nivel_hemoglobina (Aiven).")
        frames.append(df)
    except Exception as e:
        print(f"⚠️ No se pudo leer nivel_hemoglobina en Aiven ({e}).")
        if os.path.exists(CSV_CACHE):
            frames.append(pd.read_csv(CSV_CACHE))

    try:
        asegurar_tablas()
        cols = [walle_aprendizaje.c[c] for c in COLUMNAS_BASE]
        df = pd.read_sql(select(*cols), obtener_engine())
        print(f"✅ {len(df)} observaciones leídas de walle_aprendizaje.")
        frames.append(df)
    except Exception as e:
        print(f"⚠️ No se pudo leer walle_aprendizaje ({e}).")

    if not frames:
        return pd.DataFrame(columns=COLUMNAS_BASE)
    return pd.concat(frames, ignore_index=True)
