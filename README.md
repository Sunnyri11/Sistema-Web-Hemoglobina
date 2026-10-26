# Sensor HB — hardware IoT del Sistema HB

Dispositivo basado en **ESP32** que mide **hemoglobina (estimada, no invasiva)** y **temperatura corporal** en el dedo, y envía el resultado a **Firebase Realtime Database**. La página del paciente (Monitoreo) lee ese resultado, el paciente lo confirma y la API lo guarda en MySQL.

> ⚠️ **Es un prototipo académico.** La hemoglobina se *estima* con una fórmula empírica a partir de la luz roja/infrarroja que absorbe el dedo. No es un dispositivo médico, no está validado clínicamente y no reemplaza un análisis de laboratorio.

---

## 1. Cómo encaja en el sistema

```
 ┌──────────────┐  Wi-Fi   ┌─────────────────────────┐  consulta cada pocos seg  ┌──────────────────────┐
 │  ESP32 + HW  │ ───────▶ │ Firebase Realtime DB    │ ◀──────────────────────── │ Web del paciente     │
 │ Sensor_      │  JSON    │ /dispositivos_activos/  │                           │ (GitHub Pages)       │
 │ Hemoglobina  │          │        <MAC>            │ ── DELETE al leer ──────▶ │ paciente.js          │
 └──────────────┘          └─────────────────────────┘                           └──────────┬───────────┘
                                                                                            │ POST Dashboard/guardarAnalisis
                                                                                            ▼
                                                                             API C# (Render) ─▶ MySQL (Aiven)
```

1. El ESP32 se conecta al Wi-Fi y **muestra su MAC en la pantalla** (15 s).
2. El paciente abre *Analizar* en la web y **escribe esa MAC** (con o sin `:`).
3. La web comprueba que el nodo `dispositivos_activos/<MAC>` esté vacío (sensor libre) y empieza a consultarlo.
4. El paciente apoya el dedo. Tras **10 capturas** el ESP32 escribe el resultado en ese nodo.
5. La web lo detecta (`mensaje == "Exito"`), borra el nodo (deja el sensor libre) y pide confirmar.
6. Al confirmar, se guarda en la base de datos central con su observación.

---

## 2. Componentes

| Componente | Función | Bus I²C | Dirección |
|---|---|---|---|
| ESP32 (con Wi-Fi) | Controlador | — | — |
| **MAX30105** (SparkFun MAX3010x) | Luz roja, infrarroja y verde en el dedo | `Wire1` | por defecto |
| **MPU6050** | Giroscopio: detecta si la mano se mueve | `Wire1` | `0x68` |
| **MLX90614** | Temperatura sin contacto (IR) | `Wire` | `0x5A` |
| **LCD 16×2 I²C** | Mensajes al usuario | `Wire` | `0x27` |

### Conexiones

| Bus | SDA | SCL | Dispositivos |
|---|---|---|---|
| `Wire`  | GPIO **17** | GPIO **16** | LCD 16×2 + MLX90614 |
| `Wire1` | GPIO **21** | GPIO **22** | MAX30105 + MPU6050 |

Alimentación: 3.3 V y GND comunes (la LCD suele pedir 5 V; revisa tu módulo). Se usan dos buses para separar los sensores del dedo de la pantalla y el termómetro.

Si tu LCD no responde, prueba la dirección `0x3F` en `LiquidCrystal_I2C lcd(0x27, 16, 2);`.

---

## 3. Software necesario

Arduino IDE (o PlatformIO) con la placa **ESP32** instalada, y estas librerías:

| Librería | Autor |
|---|---|
| Firebase ESP Client (`Firebase_ESP_Client.h`) | Mobizt |
| SparkFun MAX3010x (`MAX30105.h`) | SparkFun |
| Adafruit MLX90614 | Adafruit |
| Adafruit MPU6050 + Adafruit Unified Sensor | Adafruit |
| LiquidCrystal I2C | Frank de Brabander |

---

## 4. Configuración antes de cargar el código

Edita estas constantes de `Sensor_Hemoglobina.ino`:

```cpp
#define WIFI_SSID     "<tu red>"
#define WIFI_PASSWORD "<tu contraseña>"
#define API_KEY       "<API key del proyecto Firebase>"
#define DATABASE_URL  "<proyecto>-default-rtdb.firebaseio.com"   // sin https://
```

`DATABASE_URL` debe ser el **mismo proyecto** que `FIREBASE_URL` en `config.js` de la web; si no, la web nunca verá los datos.

> 🔐 **No subas el `.ino` a un repositorio público con el Wi-Fi y la API key escritos.** Si ya se subieron, cambia la contraseña del Wi-Fi y regenera/restringe la API key en Firebase. Puedes sacarlos a un `secrets.h` que esté en `.gitignore`.

---

## 5. Cómo se usa

1. Enciende el equipo. La pantalla muestra `Iniciando...` → `WiFi Conectado`.
2. Durante 15 s aparece **`Copie MAC (n)`** con la MAC (12 caracteres, sin `:`). También sale por el monitor serie a 115200.
3. En la web, **Analizar → escribe la MAC → Vincular**.
4. Cuando la pantalla diga **`Poner dedo...`**, apoya el dedo sobre el MAX30105 **sin moverte**.
5. Verás `Analisis 1/10 … 10/10` con la Hb y la temperatura de cada captura (una cada 2 s, ≈ 20 s en total).
6. Al terminar muestra `Final Hb xx.x / Final T xx.x`, envía y la web pide confirmar.

### Mensajes de la pantalla

| Mensaje | Significado |
|---|---|
| `No se mueva!` | El giroscopio detectó movimiento; se reinicia la medición |
| `Dedo retirado` | La señal IR bajó del umbral; se reinicia |
| `Temperatura baja` / `alta` | Fuera de 28–42 °C (probablemente no hay dedo/piel frente al MLX90614) |
| `Error MAX30105` | No se detecta el sensor del dedo (revisa cableado `Wire1`) |
| `Error de lectura` | Ninguna captura pasó el filtro de valores atípicos |

---

## 6. Cómo funciona la medición

**Captura (cada 2 s).** Durante el intervalo se guardan el máximo y mínimo de las señales roja, IR y verde. De ahí:

- `DC` = (máx + mín) / 2 · `AC` = máx − mín
- Se resta la componente verde (ruido/movimiento) al AC rojo e IR.
- Índice de perfusión: `PI = AC / DC` para rojo e IR, y `R = PI_rojo / PI_IR`.
- **Hemoglobina estimada: `Hb = 19.5 − 6.5 · R`**, limitada a 5–20 g/dL.

**Validaciones.**

| Parámetro | Valor |
|---|---|
| Dedo presente | IR ≥ 50 000 |
| Movimiento | giro > 0.3 en cualquier eje ⇒ descarta |
| Temperatura válida | 28 °C – 42 °C |
| Capturas por análisis | 10 (`numLecturas`) |
| Intervalo de muestreo | 2 000 ms |
| Filtro final | se descartan capturas a más de ±3 g/dL o ±2 °C del promedio; se promedian las restantes |

Configuración del MAX30105: `setup(60, 4, 3, 100, 411, 4096)` → brillo 60, promedio 4, modo 3 LEDs (rojo+IR+verde), 100 muestras/s, ancho de pulso 411 µs, rango ADC 4096.

La constante `19.5` y el factor `6.5` son de **calibración empírica**; si cambias de sensor o de carcasa tendrás que recalibrarlos contra mediciones de laboratorio.

---

## 7. Datos que envía a Firebase

Nodo: `/dispositivos_activos/<MAC sin ":">`

```json
{
  "hemoglobina": 14.3,
  "temperatura": 36.4,
  "mensaje": "Exito"
}
```

La web exige `mensaje == "Exito"` y valores numéricos. Si el paciente no confirma o cancela, el nodo se borra para liberar el sensor.

---

## 8. Problemas frecuentes

| Síntoma | Qué revisar |
|---|---|
| Se queda en `Conectando WiFi...` | Red/clave incorrecta o fuera de alcance (el código espera sin límite de tiempo) |
| La web dice "dispositivo en uso" | Quedó un dato viejo en `/dispositivos_activos/<MAC>`: bórralo desde la consola de Firebase |
| La web no recibe nada | `DATABASE_URL` distinto al de `config.js`, MAC mal escrita, o reglas de Firebase que bloquean |
| `Error MAX30105` / `MPU6050` / `MLX90614` | Cables SDA/SCL cruzados, bus equivocado o falta de alimentación |
| Pantalla en blanco | Dirección `0x27` vs `0x3F`, contraste (potenciómetro) o 5 V |
| `No se mueva!` constante | Apoya la mano en una superficie fija; baja la sensibilidad (`0.3`) |
| Lecturas muy variables | Dedo con presión constante, sin luz ambiente fuerte, uña limpia |

---

## 9. Limitaciones y mejoras recomendadas

- **Seguridad:** `config.signer.test_mode = true` usa Firebase **sin autenticación**; las reglas de la base deben estar abiertas, así que cualquiera con la URL puede leer/escribir. Para producción: autenticación anónima o por dispositivo y reglas que limiten `/dispositivos_activos`.
- **Sin tiempo de espera de Wi-Fi** ni reconexión automática si se cae la red durante el uso.
- El equipo **escribe aunque nadie esté vinculado**; ese dato queda y la web lo interpreta como "en uso". Convendría que el ESP32 solo publique cuando la web marque el nodo como "esperando".
- No se envía `timestamp` (la web usa la hora del navegador).
- Calibración fija; sin validar con pacientes de distintos tonos de piel, grosor de dedo o altitud.
- La medición es orientativa: ante valores fuera de rango, confirmar con hemograma.

---

## 10. Estructura

```
iot/
├── Sensor_Hemoglobina.ino   # firmware completo (setup + loop + cálculo + envío)
└── README.md
```
