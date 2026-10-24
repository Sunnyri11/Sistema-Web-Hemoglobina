# filename: main.py
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel

from entrenamiento import (
    cargar_pkl_desde_aiven, entrenar_modelo, obtener_modelo,
    recargar_modelo, registrar_y_aprender, FEATURES,
)
from predictor import ModeloNoDisponible, generar_prediccion_y_recomendaciones


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🌅 Walle-HB despertando en Render. Sincronizando con 'walle_memory'...")
    try:
        if cargar_pkl_desde_aiven():
            recargar_modelo()
        else:
            print("🛠️ Sin memoria utilizable en Aiven: entrenamiento inicial...")
            entrenar_modelo()
    except Exception as e:  # el servicio debe arrancar aunque Aiven falle
        print(f"⚠️ Arranque degradado ({e}). Se entrenará bajo demanda.")
    yield


app = FastAPI(title="Walle-HB: IA Médica Evolutiva", lifespan=lifespan)


class RegistroHb(BaseModel):
    valor_hemoglobina: float
    valor_min: float
    valor_max: float
    temperatura: Optional[float] = None
    fecha: Optional[str] = None  # "yyyy-MM-dd"


class DatosPaciente(BaseModel):
    id_usuario: Optional[int] = None
    id_genero: int
    altitud: float
    edad: int
    ultimo_dato: RegistroHb        # OBLIGATORIO: el análisis más reciente
    historial: List[RegistroHb]    # OBLIGATORIO: todos los análisis del paciente


def _ordenar_nuevo_primero(historial, ultimo):
    """Une historial + último dato (sin duplicarlo) y ordena del más nuevo al más antiguo."""
    registros = list(historial)
    ya_esta = any(
        r.fecha == ultimo.fecha and abs(r.valor_hemoglobina - ultimo.valor_hemoglobina) < 1e-6
        for r in registros
    )
    if not ya_esta:
        registros.insert(0, ultimo)
    if all(r.fecha for r in registros):
        # sort estable: dentro de un mismo día se respeta el orden recibido
        registros = sorted(registros, key=lambda r: r.fecha, reverse=True)
    return registros


def _aprender_en_segundo_plano(paciente: DatosPaciente, registros: List[RegistroHb]):
    """Guarda lo nuevo en Aiven y reentrena solo si hubo datos nuevos."""
    try:
        filas = [{
            "id_usuario": paciente.id_usuario,
            "fecha": r.fecha,
            "id_genero": paciente.id_genero,
            "altitud": paciente.altitud,
            "edad": paciente.edad,
            "valor_min": r.valor_min,
            "valor_max": r.valor_max,
            "valor_hemoglobina": r.valor_hemoglobina,
        } for r in registros]
        registrar_y_aprender(filas)
    except Exception as e:
        print(f"⚠️ No se pudo auto-actualizar la memoria en este turno: {e}")


@app.get("/")
def estado_servicio():
    return {"servicio": "Walle-HB", "modelo_cargado": obtener_modelo() is not None, "features": FEATURES}


# =====================================================================
# 🎯 PREDICCIÓN (POST /): recibe ultimo_dato + historial desde C#
# =====================================================================
@app.post("/")
def predecir_salud(paciente: DatosPaciente, tareas: BackgroundTasks):
    ultimo = paciente.ultimo_dato
    registros = _ordenar_nuevo_primero(paciente.historial, ultimo)

    lista_datos = [
        paciente.id_genero, paciente.altitud, paciente.edad,
        ultimo.valor_min, ultimo.valor_max, ultimo.valor_hemoglobina,
    ]
    # historial completo con fechas, del más nuevo al más antiguo
    serie = [{"fecha": r.fecha, "valor_hemoglobina": r.valor_hemoglobina} for r in registros]

    try:
        estado, alertas, recomendaciones, prediccion = generar_prediccion_y_recomendaciones(
            lista_datos, serie
        )
    except ModeloNoDisponible as e:
        raise HTTPException(status_code=503, detail=str(e))

    # La respuesta sale ya; aprender + subir la memoria ocurre después.
    tareas.add_task(_aprender_en_segundo_plano, paciente, registros)

    return {
        "estado": [str(estado)],
        "prediccion_ia": str(estado),
        "alertas": alertas,
        "recomendaciones": recomendaciones,
        "prediccion": prediccion,  # valor/estado proyectado, riesgo, confianza, etc.
    }


# =====================================================================
# 🔄 ACTUALIZACIÓN MANUAL (PUT /): reentrena con todo y sube a walle_memory
# =====================================================================
@app.put("/")
def actualizar_memoria_ia():
    try:
        r = entrenar_modelo()
        return {
            "status": "success" if r["subido_a_aiven"] else "warning",
            "mensaje": ("Memoria entrenada y guardada en walle_memory."
                        if r["subido_a_aiven"]
                        else "Entrenada, pero NO se pudo guardar en walle_memory (revisa los logs)."),
            "registros_reales": r["registros_reales"],
            "precision": r["precision"],
        }
    except Exception as e:
        return {"status": "error", "mensaje": str(e)}
