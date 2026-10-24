<p align="center">
  <img src="assets/walle-hb.png" alt="Walle-HB, el asistente médico con IA" width="220">
</p>

<h1 align="center">Walle-HB</h1>

<p align="center">
  <b>IA médica evolutiva para el monitoreo de hemoglobina en altura.</b><br>
  Clasifica, proyecta, recomienda y aprende de cada análisis del paciente.
</p>

<p align="center">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white">
  <img alt="scikit-learn" src="https://img.shields.io/badge/scikit--learn-F7931E?logo=scikitlearn&logoColor=white">
  <img alt="MySQL en Aiven" src="https://img.shields.io/badge/MySQL-Aiven-4479A1?logo=mysql&logoColor=white">
  <img alt="Render" src="https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render&logoColor=white">
</p>

---

## ¿Qué es Walle-HB?

Walle-HB es el microservicio de inteligencia artificial del **Sistema HB**. Recibe el **último análisis** y el **historial completo** de hemoglobina de un paciente y devuelve:

- **Estado actual:** `Anemia`, `Estable` o `Poliglobulia`, clasificado por un modelo de aprendizaje automático.
- **Proyección:** hemoglobina esperada al próximo control y estado proyectado.
- **Riesgo** (Bajo / Medio / Alto), **gravedad**, **tendencia** y **confianza** de la estimación.
- **Alertas y recomendaciones** personalizadas según el estado, la gravedad, la tendencia, la altitud y la edad.
- **Aprendizaje continuo:** cada dato nuevo se guarda, la IA se reentrena sola y su memoria se conserva en la base de datos.

> ⚠️ Walle-HB es una herramienta de **apoyo**. Sus proyecciones son estimaciones estadísticas orientativas y **no reemplazan la valoración de un médico**.

## Arquitectura

```mermaid
flowchart LR
    F["Frontend<br/>paciente.js"] -->|GET /Dashboard/paciente| C["API C#<br/>(SistemaHB)"]
    C -->|"POST /<br/>ultimo_dato + historial"| W["Walle-HB<br/>FastAPI en Render"]
    W -->|"estado, proyección,<br/>riesgo, recomendaciones"| C
    W <-->|"walle_memory<br/>walle_aprendizaje<br/>nivel_hemoglobina<br/>rango_hemoglobina"| A[("MySQL<br/>Aiven")]
    C <--> A
```

1. El paciente abre su pantalla y el frontend consulta a la API C#.
2. La API C# arma el payload (último dato + historial) y se lo envía a Walle-HB.
3. Walle-HB responde y, en segundo plano, guarda lo nuevo y se reentrena si hace falta.
4. La memoria entrenada se guarda en Aiven, así sobrevive a los reinicios de Render.

## Estructura del proyecto

```
.
├── main.py                      # API FastAPI (GET / · POST / · PUT /) y arranque
├── predictor.py                 # Predicción, proyección, riesgo y recomendaciones
├── entrenamiento.py             # Entrenamiento, reentrenamiento y ciclo de la memoria (.pkl)
├── aiven.py                     # Todo el acceso a Aiven (MySQL)
├── generar_dataset.py           # Datos sintéticos para el arranque en frío
├── nivel_hemoglobina_train.csv  # Dataset sintético generado
├── requirements.txt
└── assets/
    └── walle-hb.png             # Logo
```

## Cómo funciona

### Ciclo de vida de la memoria

| Momento | Qué ocurre |
|---|---|
| **Arranque** | Descarga la memoria (`.pkl`) de la tabla `walle_memory`. Si no hay, está dañada o es de una versión anterior, entrena una nueva. |
| **Predicción** (`POST /`) | Clasifica, proyecta y responde de inmediato. |
| **Después de responder** | Guarda en `walle_aprendizaje` los análisis que aún no conocía. **Solo si había datos nuevos** reentrena y sube la memoria actualizada. |
| **Manual** (`PUT /`) | Reentrena con todos los datos y sube la memoria. |

La memoria se reemplaza de forma **atómica** (`DELETE` + `INSERT` en una sola transacción) y el `.pkl` local se escribe a un temporal antes de reemplazarlo, así nunca queda un archivo a medias.

### El modelo

**Tipo de árbol: Random Forest (bosque aleatorio) de árboles de decisión de clasificación.** Son 50 árboles tipo **CART** (`RandomForestClassifier` de scikit-learn, `n_estimators=50`, `random_state=42`) que dividen los datos con el criterio de **impureza de Gini**.

#### ¿Qué hace?

Clasifica cada análisis en una de tres clases: **`Anemia`**, **`Estable`** o **`Poliglobulia`**.

1. Cada árbol se entrena con una muestra aleatoria de los datos (*bootstrap*) y, en cada división, considera solo un subconjunto de variables. Así los 50 árboles son distintos entre sí.
2. Cada árbol hace preguntas del tipo *«¿la Hb está a más de 0.3 g/dL sobre el máximo?»* hasta llegar a una clase.
3. El resultado final es la **votación mayoritaria** de los 50 árboles.

**Por qué un bosque y no un solo árbol:** un árbol solo tiende a memorizar los datos (sobreajuste) y cambia mucho con pocos registros. Promediar 50 árboles da resultados más estables, y es rápido de entrenar y de ejecutar en el plan gratuito de Render. Además, es explicable: se puede ver qué variables pesan más (`importancias`).

**Por qué no una red neuronal:** hay pocos datos reales, el problema es tabular y los umbrales clínicos son reglas de corte, justo lo que los árboles aprenden bien.

#### Entradas (8)

`id_genero`, `altitud`, `edad`, `valor_min`, `valor_max`, `valor_hemoglobina` y dos derivadas: `dif_min` y `dif_max` (a cuántos g/dL está la Hb de su mínimo y de su máximo). Estas dos son las que permiten acertar justo en los límites.

#### Entrenamiento

- **Datos reales** (`nivel_hemoglobina` + `walle_aprendizaje`) con **10× más peso**, más **datos sintéticos** (incluyendo casos en los límites) para el arranque en frío.
- **Evaluación:** se separa un 20 % de prueba *antes* de ponderar, para no inflar la precisión. El modelo final se entrena con todos los datos.
- **Reentrenamiento:** solo cuando llegan observaciones nuevas, nunca en cada consulta.
- **Memoria:** el bosque completo se guarda con `joblib` como `.pkl` en `walle_memory` (Aiven). Si el `.pkl` es de una versión anterior (otras variables), se descarta y se reentrena.

#### Red de seguridad clínica

Si la IA contradijera el rango de referencia del paciente (por ejemplo, Hb por encima del máximo pero clasificada como Estable), **prevalece el rango** y se registra un aviso en el log.

#### Limitaciones del modelo

- Con muy pocos datos reales, el bosque depende sobre todo de los datos sintéticos, que siguen los mismos rangos.
- Clasifica el **estado de un análisis**; la proyección a futuro la hace el predictor de regresión (siguiente sección), no el árbol.
- No reemplaza el diagnóstico médico.

### Proyección, riesgo y confianza

- **Proyección:** regresión lineal sobre las **fechas reales** del historial, con más peso a los análisis recientes. El horizonte es la mediana entre controles (entre 14 y 60 días) y el cambio proyectado se limita a ±3 g/dL.
- **Requisito:** al menos 2 análisis separados por **7 días o más**. Si no, no proyecta y lo indica.
- **Gravedad:** distancia al rango: `leve` (< 1 g/dL), `moderada` (1 a 2.5) o `severa` (≥ 2.5).
- **Riesgo:** combina la gravedad actual, el margen al límite y lo que se proyecta (si hoy está estable pero se proyecta una salida del rango, sube).
- **Confianza:** `baja`, `media` o `alta` según cuántos análisis hay, qué tan dispersos están y si hay fechas reales.
- **Próximo control sugerido:** 14 días (riesgo alto), 21 (medio) o el horizonte (bajo).

## API

### `GET /` — estado del servicio

```json
{ "servicio": "Walle-HB", "modelo_cargado": true, "features": ["id_genero", "altitud", "…"] }
```

### `POST /` — predecir (y aprender)

`ultimo_dato` e `historial` son **obligatorios**. Si faltan, responde `422`.

```json
{
  "id_usuario": 4,
  "id_genero": 1,
  "altitud": 3640,
  "edad": 29,
  "ultimo_dato": {
    "valor_hemoglobina": 15.9, "valor_min": 14.8, "valor_max": 19.8,
    "temperatura": 36.8, "fecha": "2026-10-22"
  },
  "historial": [
    { "valor_hemoglobina": 15.9, "valor_min": 14.8, "valor_max": 19.8, "temperatura": 36.8, "fecha": "2026-10-22" },
    { "valor_hemoglobina": 16.3, "valor_min": 14.8, "valor_max": 19.8, "temperatura": 36.7, "fecha": "2026-10-01" },
    { "valor_hemoglobina": 16.6, "valor_min": 14.8, "valor_max": 19.8, "temperatura": 36.5, "fecha": "2026-09-01" }
  ]
}
```

Respuesta (resumida):

```json
{
  "estado": ["Estable"],
  "prediccion_ia": "Estable",
  "alertas": ["Reporte de Walle-HB: Tu estado actual es clasificado como Estable con 15.9 g/dL.\n\n…\n\n🔮 Proyección a 30 días: ≈ 15.6 g/dL (Anemia). Riesgo alto. Confianza media (3 análisis)."],
  "recomendaciones": ["• …", "• Próximo control sugerido: en unos 14 días."],
  "prediccion": {
    "valor_actual": 15.9,
    "valor_proyectado": 15.58,
    "horizonte_dias": 30,
    "estado_proyectado": "Anemia",
    "tendencia": "descendente",
    "cambio_esperado": -0.32,
    "riesgo": "Alto",
    "gravedad": "ninguna",
    "margen_al_limite": 1.1,
    "dias_hasta_salir_rango": 103,
    "dias_hasta_normalizar": null,
    "proximo_control_dias": 14,
    "confianza": "media",
    "puntos_usados": 3,
    "fechas_reales": true,
    "rango_referencia": [14.8, 19.8]
  }
}
```

| Código | Significado |
|---|---|
| `200` | Predicción correcta |
| `422` | Falta `ultimo_dato` o `historial`, o tienen un formato inválido |
| `503` | La IA aún no tiene un modelo entrenado |

### `PUT /` — reentrenar manualmente

Reentrena con todos los datos y sube la memoria a `walle_memory`.

```json
{ "status": "success", "mensaje": "Memoria entrenada y guardada en walle_memory.", "registros_reales": 15, "precision": 1.0 }
```

`status` es `warning` si se entrenó pero no se pudo guardar en Aiven, y `error` si falló el entrenamiento.

## Base de datos

Walle-HB usa la base **`sistemahb`** (MySQL en Aiven).

| Tabla | Uso |
|---|---|
| `walle_memory` | La memoria de la IA: el modelo completo en un `LONGBLOB`. Debe tener **una sola fila**. |
| `walle_aprendizaje` | Análisis recibidos desde C#, sin duplicados (columna única `huella`). Crece con el tiempo. |
| `nivel_hemoglobina` | Análisis clínicos de los pacientes (solo lectura). |
| `rango_hemoglobina` | Rangos de referencia por ciudad, género, edad y observación (solo lectura). |

Walle-HB crea `walle_memory` y `walle_aprendizaje` por su cuenta si no existen.

### Rangos de referencia

`valor_min` y `valor_max` dependen de la **ciudad (altitud), el género, la edad y la observación clínica**:

- **Base:** umbrales de anemia de la OMS por edad y sexo.
- **Altitud:** ajuste de la OMS calibrado con datos de adultos sanos de **La Paz (3600 m)** y **Potosí (4000 m)**, porque el ajuste original sobrestima la hemoglobina normal de los andinos.
- **Observaciones:** embarazo y tabaquismo desplazan el rango; anemia ferropénica y enfermedad renal bajan el mínimo; deshidratación y EPOC suben el máximo.

## Instalación y ejecución local

Requisitos: **Python 3.10+** y acceso a la base de datos.

```bash
git clone <url-del-repositorio>
cd walle-hb

python -m venv .venv
source .venv/bin/activate        # En Windows: .venv\Scripts\activate
pip install -r requirements.txt

export DATABASE_URL="mysql+pymysql://USUARIO:CLAVE@HOST:PUERTO/sistemahb"
uvicorn main:app --reload
```

La documentación interactiva queda en <http://localhost:8000/docs>.

Para entrenar a mano desde la terminal: `python entrenamiento.py`.

### Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión completa (`mysql+pymysql://…`). Tiene prioridad sobre las demás. |
| `AIVEN_USER` · `AIVEN_PASSWORD` · `AIVEN_HOST` · `AIVEN_PORT` · `AIVEN_DB` | Alternativa a `DATABASE_URL`, por partes. |
| `WALLE_PKL` | Ruta local del `.pkl` (por defecto `mini_ia_hemoglobina.pkl`). |

> 🔐 **No subas credenciales al repositorio.** Define estas variables en el panel de Render (*Environment*) y rota la clave de Aiven si alguna vez estuvo escrita en el código.

## Despliegue en Render

| Campo | Valor |
|---|---|
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Environment** | `DATABASE_URL` (o las variables `AIVEN_*`) |

En el plan gratuito Render **duerme el servicio** tras un rato sin uso y tarda unos 50 segundos en despertar. Mientras tanto, la API C# responde `Procesando...` y el frontend reintenta solo. Al despertar, Walle-HB recupera su memoria de Aiven, por lo que no pierde lo aprendido.

## Limitaciones

- La edad se maneja en años cumplidos: el rango de **0 años** abarca desde el recién nacido hasta los 11 meses, así que es amplio a propósito.
- La calibración por altitud se apoya en datos de **3600 a 4000 m en adultos**. Para otras altitudes y para niños se mantiene la misma proporción, pero es una estimación.
- Con pocos análisis la proyección es orientativa (confianza baja).
- Las cifras de las observaciones clínicas provienen de la literatura y conviene que las valide un hematólogo.

## Referencias

- OMS (2011). *Concentraciones de hemoglobina para el diagnóstico de la anemia y la evaluación de su gravedad.*
- Gonzales G. F. et al. (2018). *Correcting the cut-off point of hemoglobin at high altitude favors misclassification of anemia, erythrocytosis and excessive erythrocytosis.* Am J Hematol.
- UMSA. [Valores de referencia para anemia ferropénica en adultos de La Paz (3600 m)](https://repositorio.umsa.bo/xmlui/handle/123456789/18991).
- UMSA. [Valores hematológicos normales en personas sanas a 4.000 metros en Bolivia](https://repositorio.umsa.bo/xmlui/handle/123456789/8618).
