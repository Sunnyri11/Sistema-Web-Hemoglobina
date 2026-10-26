/* ============================================================================
 * paciente.js  (versión corregida y optimizada)
 * Requiere config.js con las constantes globales: API_URL y FIREBASE_URL
 * ========================================================================== */
"use strict";

// ----------------------------------------------------------------------------
// Constantes y estado
// ----------------------------------------------------------------------------
const RANGO_HB_DEFECTO = { min: 14.8, max: 19.8 };   // adulto en altura, hasta que llegue el rango real
const POLLING_MS = 2000;
const TIMEOUT_SENSOR_MS = 60000;
const REINTENTO_IA_MS = 12000;   // Render gratis tarda en despertar: se reintenta solo
const MAX_REINTENTOS_IA = 5;

const estado = {
    historialCompleto: [],     // Paciente/mihistorial
    historialDashboard: [],    // Dashboard/paciente
    nombre: "Paciente",
    filtro: "todos",
    rango: { ...RANGO_HB_DEFECTO },
    medicion: null,            // medición temporal del sensor (antes de guardar)
    prediccion: null,          // predicciones de Walle-HB (analisisIA.prediccion)
    proyeccion: null,          // punto proyectado que se dibuja en el gráfico
    reintentoIA: null,
    reintentosIA: 0,
    sensor: { intervalo: null, timeout: null }
};

let graficoHemoInstancia = null;
let graficoTempInstancia = null;

// ----------------------------------------------------------------------------
// Utilidades
// ----------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const getToken = () => (localStorage.getItem("token_seguridad") || "").trim();
const getUserId = () => localStorage.getItem("usuario_id");

function setTexto(id, texto) {
    const el = $(id);
    if (el) el.textContent = texto;
}

function mostrar(id, display) {
    const el = $(id);
    if (el) el.style.display = display;
}

function escapeHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

// Lee un campo sin importar si el backend lo manda en camelCase o PascalCase
function campo(obj, nombre) {
    if (!obj) return undefined;
    return obj[nombre] ?? obj[nombre.charAt(0).toUpperCase() + nombre.slice(1)];
}

function aNumero(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

// fetch con token y JSON por defecto
function apiFetch(ruta, opciones = {}) {
    const { headers, ...resto } = opciones;
    return fetch(`${API_URL}${ruta}`, {
        ...resto,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getToken()}`,
            ...headers
        }
    });
}

// Lectores tolerantes a mayúsculas/minúsculas del backend
const leerFecha = (r) => r.fecha || r.Fecha || r.fechaAnalisis || r.FechaAnalisis || null;
const leerHemo = (r) => parseFloat(r.valorHemoglobina ?? r.ValorHemoglobina ?? 0) || 0;
const leerTemp = (r) => parseFloat(r.temperatura ?? r.Temperatura ?? 0) || 0;

// Rango de referencia propio de cada análisis (el backend lo envía como valorMin/valorMax)
function leerRango(r) {
    const min = aNumero(r.valorMin ?? r.ValorMin);
    const max = aNumero(r.valorMax ?? r.ValorMax);
    return min !== null && max !== null ? { min, max } : null;
}

// Parseo seguro de fechas "YYYY-MM-DD" (evita desfase de zona horaria)
function parseFecha(valor) {
    if (!valor) return null;
    if (typeof valor === "string") {
        const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
    const d = new Date(valor);
    return isNaN(d) ? null : d;
}

const soloDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function historialActivo() {
    return estado.historialDashboard.length > 0
        ? estado.historialDashboard
        : estado.historialCompleto;
}

function registroMasReciente(lista) {
    if (!lista.length) return {};
    return lista.reduce((mejor, actual) => {
        const fm = parseFecha(leerFecha(mejor));
        const fa = parseFecha(leerFecha(actual));
        if (!fm) return actual;
        if (!fa) return mejor;
        return fa >= fm ? actual : mejor;
    });
}

function clasificarHemoglobina(valor, rango = estado.rango) {
    if (valor < rango.min) return { clase: "anemia", texto: "ALERTA DE ANEMIA", pdf: "Alerta de Anemia" };
    if (valor > rango.max) return { clase: "poliglobulia", texto: "ALERTA DE POLIGLOBULIA", pdf: "Alerta de Poliglobulia" };
    return { clase: "estable", texto: "FISIOLÓGICAMENTE ESTABLE", pdf: "Normal (Estable)" };
}

// ----------------------------------------------------------------------------
// Gráfico de línea simple en canvas (sin librerías)
// ----------------------------------------------------------------------------
class MiniChartSingleLine {
    // autoEscala: el eje Y se ajusta a los datos (escalones enteros) para que
    // los valores altos de la altura (hasta ~21 g/dL) no queden recortados.
    constructor(canvasId, minVal, maxVal, color, esTemp, autoEscala = false) {
        this.canvas = $(canvasId);
        this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
        this.min = minVal;
        this.max = maxVal;
        this.color = color;
        this.esTemp = esTemp;
        this.autoEscala = autoEscala;
        this.ultimo = null; // últimos datos, para redibujar al cambiar el tamaño
    }

    redibujar() {
        if (this.ultimo) this.render(...this.ultimo);
    }

    // opciones.banda      = { min, max }            -> franja del rango normal
    // opciones.proyeccion = { valor, etiqueta, color } -> punto proyectado por Walle-HB
    render(etiquetas, datos, opciones = {}) {
        this.ultimo = [etiquetas, datos, opciones];
        const { canvas, ctx } = this;
        if (!canvas || !ctx) return;
        const banda = opciones.banda || null;
        const proy = opciones.proyeccion || null;

        let min = this.min, max = this.max;
        if (this.autoEscala) {
            const vals = [...datos];
            if (banda) vals.push(banda.min, banda.max);
            if (proy) vals.push(proy.valor);
            if (vals.length) {
                min = Math.floor(Math.min(...vals) - 1);
                const tope = Math.ceil(Math.max(...vals) + 1);
                max = min + Math.max(8, Math.ceil((tope - min) / 4) * 4);
            }
        }
        const rango = max - min;

        const dpr = window.devicePixelRatio || 1;
        const alto = 240;
        canvas.style.width = "100%";
        const ancho = canvas.getBoundingClientRect().width || 300;
        canvas.width = Math.round(ancho * dpr);
        canvas.height = alto * dpr;
        canvas.style.height = alto + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, ancho, alto);
        ctx.textAlign = "left";

        const izq = 50, arriba = 30, anchoUtil = ancho - 90, altoUtil = 150;
        const yDe = (v) => arriba + altoUtil - ((Math.min(Math.max(v, min), max) - min) / rango) * altoUtil;

        // Rejilla y escala del eje Y
        ctx.strokeStyle = "#f1f5f9";
        ctx.lineWidth = 1;
        ctx.font = "11px sans-serif";
        for (let l = 0; l <= 4; l++) {
            const valor = min + (rango / 4) * l;
            const y = arriba + altoUtil - (l / 4) * altoUtil;
            ctx.beginPath();
            ctx.moveTo(izq, y);
            ctx.lineTo(ancho - 40, y);
            ctx.stroke();
            ctx.fillStyle = "#64748b";
            ctx.fillText(valor.toFixed(1), 10, y + 4);
        }

        if (!datos.length) {
            ctx.fillStyle = "#94a3b8";
            ctx.font = "13px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Sin registros en este período", izq + anchoUtil / 2, arriba + altoUtil / 2);
            ctx.textAlign = "left";
            return;
        }

        // Franja del rango normal del paciente
        if (banda) {
            const y1 = yDe(banda.max), y2 = yDe(banda.min);
            ctx.fillStyle = "rgba(34, 197, 94, 0.10)";
            ctx.fillRect(izq, y1, anchoUtil, y2 - y1);
            ctx.fillStyle = "rgba(21, 128, 61, 0.85)";
            ctx.font = "10px sans-serif";
            ctx.fillText(`Rango normal ${banda.min.toFixed(1)}–${banda.max.toFixed(1)}`, izq + 6, y1 + 12);
        }

        const total = datos.length + (proy ? 1 : 0);
        const xDe = (idx) => izq + (total > 1 ? (idx / (total - 1)) * anchoUtil : anchoUtil / 2);
        const puntos = datos.map((val, idx) => ({ x: xDe(idx), y: yDe(val), v: val }));

        // Línea
        ctx.beginPath();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        puntos.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();

        // Tramo proyectado (discontinuo)
        let puntoProy = null;
        if (proy) {
            puntoProy = { x: xDe(total - 1), y: yDe(proy.valor), v: proy.valor };
            const ult = puntos[puntos.length - 1];
            ctx.save();
            ctx.setLineDash([6, 5]);
            ctx.beginPath();
            ctx.strokeStyle = proy.color || this.color;
            ctx.lineWidth = 2.5;
            ctx.moveTo(ult.x, ult.y);
            ctx.lineTo(puntoProy.x, puntoProy.y);
            ctx.stroke();
            ctx.restore();
        }

        // Nodos y valores
        const nodo = (p, color, texto) => {
            ctx.beginPath();
            ctx.fillStyle = "#ffffff";
            ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = "#1e293b";
            ctx.font = "bold 10px sans-serif";
            ctx.fillText(texto, p.x - 10, p.y - 10);
        };
        puntos.forEach((p) => nodo(p, this.color, p.v.toFixed(1) + (this.esTemp ? "°" : "")));
        if (puntoProy) nodo(puntoProy, proy.color || this.color, "≈" + puntoProy.v.toFixed(1));

        // Eje X (se omiten rótulos si hay demasiados; el de la proyección siempre se muestra)
        const rotulos = proy ? [...etiquetas, proy.etiqueta || "Proy."] : etiquetas;
        const maxEtiquetas = Math.max(1, Math.floor(anchoUtil / 45));
        const paso = Math.ceil(total / maxEtiquetas);
        ctx.fillStyle = "#64748b";
        ctx.font = "10px sans-serif";
        rotulos.forEach((texto, idx) => {
            const esProy = proy && idx === total - 1;
            const visible = esProy || (idx % paso === 0 && !(proy && idx === total - 2));
            if (!visible) return;
            const x = xDe(idx);
            ctx.save();
            ctx.translate(x, alto - 15);
            ctx.rotate(-0.15);
            ctx.fillText(texto, -20, 10);
            ctx.restore();
        });
    }
}

function inicializarGrafico(etiquetas, valoresHemo, valoresTemp) {
    if (!graficoHemoInstancia) {
        graficoHemoInstancia = new MiniChartSingleLine("graficoHemoglobina", 8, 24, "#818cf8", false, true);
    }
    if (!graficoTempInstancia) {
        graficoTempInstancia = new MiniChartSingleLine("graficoTemperatura", 35, 41, "#f97316", true);
    }
    const hayDatos = valoresHemo.length > 0;
    graficoHemoInstancia.render(etiquetas, valoresHemo, hayDatos
        ? { banda: { ...estado.rango }, proyeccion: estado.proyeccion }
        : {});
    graficoTempInstancia.render(etiquetas, valoresTemp);
}

// ----------------------------------------------------------------------------
// Filtro cronológico
// ----------------------------------------------------------------------------
function procesarFiltroCronologico(tipoFiltro) {
    estado.filtro = tipoFiltro;

    // Resaltar el botón activo
    document.querySelectorAll(".filtros-botones .btn-filtro").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.filtro === tipoFiltro);
    });

    const origen = historialActivo();
    if (!origen.length) {
        inicializarGrafico([], [], []);
        return;
    }

    const hoy = soloDia(new Date());
    const diasDesdeHoy = (fecha) => Math.round((hoy - fecha) / 86400000);

    const reglas = {
        dias: (f) => diasDesdeHoy(f) === 0,
        semanas: (f) => { const d = diasDesdeHoy(f); return d >= 0 && d <= 7; },
        meses: (f) => f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth(),
        anos: (f) => f.getFullYear() === hoy.getFullYear(),
        todos: () => true
    };
    const cumple = reglas[tipoFiltro] || reglas.todos;

    const registros = origen
        .map((r, idx) => {
            const f = parseFecha(leerFecha(r));
            return { r, idx, fecha: f && soloDia(f) };
        })
        .filter((x) => !x.fecha || cumple(x.fecha))
        .sort((a, b) => {
            if (!a.fecha || !b.fecha) return a.idx - b.idx;
            return a.fecha - b.fecha;
        });

    const etiquetas = registros.map((x) =>
        x.fecha
            ? `${x.fecha.getDate()}/${x.fecha.getMonth() + 1}`
            : "Reg. " + (x.r.idNivel || x.r.IdNivel || x.idx + 1)
    );

    inicializarGrafico(
        etiquetas,
        registros.map((x) => leerHemo(x.r)),
        registros.map((x) => leerTemp(x.r))
    );
}

// Compatibilidad con llamadas externas
function aplicarFiltroTiempo(tipoFiltro) {
    procesarFiltroCronologico(tipoFiltro);
}
window.aplicarFiltroTiempo = aplicarFiltroTiempo;

// ----------------------------------------------------------------------------
// Observaciones clínicas (select del modal)
// ----------------------------------------------------------------------------
async function cargarObservacionesEnSelect() {
    const cbo = $("cboObservaciones");
    if (!cbo) return;

    try {
        const respuesta = await apiFetch("observaciones/observacionesclinicas");
        if (!respuesta.ok) throw new Error("Error al obtener observaciones.");

        const datos = await respuesta.json();
        const fragmento = document.createDocumentFragment();

        const base = document.createElement("option");
        base.value = "0";
        base.textContent = "--- Ninguna (Estado de Salud Normal) ---";
        fragmento.appendChild(base);

        datos.forEach((item) => {
            const obs = item.observaciones || item.observacion;
            if (!obs) return;
            const opt = document.createElement("option");
            opt.value = obs.idObservacion;
            opt.textContent = obs.observacion;
            fragmento.appendChild(opt);
        });

        cbo.replaceChildren(fragmento);
    } catch (error) {
        console.error("Error poblando el selector:", error);
        cbo.innerHTML = '<option value="0">Error al cargar observaciones de la BD</option>';
    }
}

// ----------------------------------------------------------------------------
// Sesión
// ----------------------------------------------------------------------------
function cerrarSesion() {
    localStorage.removeItem("token_seguridad");
    localStorage.removeItem("usuario_id");
    window.location.href = "../index.html";
}

// ----------------------------------------------------------------------------
// Datos personales
// ----------------------------------------------------------------------------
function calcularEdad(fechaNacimiento) {
    const nac = parseFecha(fechaNacimiento);
    if (!nac) return "-";
    const hoy = new Date();
    let edad = hoy.getFullYear() - nac.getFullYear();
    const dm = hoy.getMonth() - nac.getMonth();
    if (dm < 0 || (dm === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad;
}

async function cargarPaciente() {
    try {
        const id = getUserId();
        if (!getToken() || !id) {
            console.error("No se encontró el token o el ID del usuario en el almacenamiento local.");
            return;
        }

        const respuesta = await apiFetch(`Paciente/MisDatos/${id}`);
        if (!respuesta.ok) return;

        const d = await respuesta.json();
        const persona = d.Persona || d.persona;
        const correo = d.Correo || d.correo;
        const tipoSangre = d.TipoSangre || d.tipoSangre;

        const nombre = persona
            ? `${persona.Nombre || persona.nombre || ""} ${persona.Paterno || persona.paterno || ""} ${persona.Materno || persona.materno || ""}`.trim()
            : "Paciente sin nombre";

        setTexto("nombrePacienteDisplay", nombre || "Paciente sin nombre");
        setTexto("correoPacienteDisplay", correo ? (correo.CorreoElectronico || correo.correoElectronico || "Sin correo") : "Sin correo");
        setTexto("edadDisplay", calcularEdad(d.fechaNacimiento?.fechaDeNacimiento));
        setTexto("deptoDisplay", d.departamento?.departamento1 ?? "-");
        setTexto("ciudadDisplay", d.ciudad?.nombre ?? "-");
        setTexto("sangreDisplay", tipoSangre ? (tipoSangre.tipoDeSangre || tipoSangre.TipoDeSangre || "No registrado") : "No registrado");
    } catch (error) {
        console.error("Error en la petición fetch de datos personales:", error);
    }
}

// ----------------------------------------------------------------------------
// Tarjeta de estado clínico
// ----------------------------------------------------------------------------
const ICONO_PULSO = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';
const ICONO_INFO = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';

function pintarEstado(clase, titulo, detalle) {
    const div = $("estadoPaciente");
    if (!div) return;
    div.className = `estado ${clase}`;
    div.innerHTML = `
        <div class="estado-icon-wrapper">${clase === "sin-datos" ? ICONO_INFO : ICONO_PULSO}</div>
        <div class="estado-text-content">
            <span class="estado-title-label">ESTADO</span>
            <strong>${escapeHtml(titulo)}</strong>
            ${detalle ? `<span class="estado-detalle-medicion">${escapeHtml(detalle)}</span>` : ""}
        </div>`;
}

const detalleMedicion = (hemo, temp) => `(${hemo} G/DL) TEMPERATURA: ${temp} °C`;

function pintarSinAnalisis() {
    pintarEstado("sin-datos", "SIN ANÁLISIS REGISTRADOS", "");
}

async function actualizarEstadoClinico() {
    if (!$("estadoPaciente")) return;

    try {
        const respuesta = await apiFetch(`RangoHemoglobina/mirango/${getUserId()}`);
        if (!respuesta.ok) throw new Error("Error al obtener el historial clínico del paciente.");

        const datos = await respuesta.json();
        if (!datos || datos.length === 0) {
            pintarSinAnalisis();
            return;
        }
        const ultimo = registroMasReciente(datos);
        const ref = ultimo.rangoReferencia;
        if (ref && ref.valorMinimo != null && ref.valorMaximo != null) {
            estado.rango = { min: ref.valorMinimo, max: ref.valorMaximo };
        }

        const hemo = ultimo.valorHemoglobina;
        const { clase, texto } = clasificarHemoglobina(hemo);
        pintarEstado(clase, texto, detalleMedicion(hemo, ultimo.temperatura));
    } catch (error) {
        console.error("Error en el flujo de rangos:", error);
    }
}

// ----------------------------------------------------------------------------
// Módulo analítico Walle-HB
// ----------------------------------------------------------------------------
const COLOR_ESTADO = { anemia: "#c0392b", poliglobulia: "#d35400", estable: "#27ae60" };

const ESTILOS_WALLE = `
.walle-pred { margin: 14px 0 6px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; text-align: left; }
.walle-pred h5 { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: var(--text-main, #0f172a); }
.walle-pred-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
.walle-pred-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
.walle-pred-item small { display: block; color: #64748b; font-size: 11px; margin-bottom: 2px; }
.walle-pred-item strong { font-size: 16px; color: var(--text-main, #0f172a); }
.walle-pred-item > span { display: block; font-size: 11px; color: #64748b; margin-top: 3px; }
.walle-chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; line-height: 1.4; color: #fff; }
.walle-chip.bajo, .walle-chip.estable { background: #27ae60; }
.walle-chip.medio { background: #e69a00; }
.walle-chip.alto, .walle-chip.anemia { background: #c0392b; }
.walle-chip.poliglobulia { background: #d35400; }
.walle-pred-nota { margin: 10px 0 0; font-size: 11px; color: #64748b; }
.walle-cargando { color: #64748b; font-style: italic; }`;

function asegurarEstilosWalle() {
    if ($("estilosWalleHB")) return;
    const st = document.createElement("style");
    st.id = "estilosWalleHB";
    st.textContent = ESTILOS_WALLE;
    document.head.appendChild(st);
}

const claseEstado = (txt) => {
    const c = String(txt || "").toLowerCase();
    return c.includes("anemia") ? "anemia" : c.includes("poliglobulia") ? "poliglobulia" : "estable";
};

function normalizarPrediccion(raw) {
    if (!raw || typeof raw !== "object") return null;
    const p = {
        valorActual: aNumero(campo(raw, "valorActual")),
        valorProyectado: aNumero(campo(raw, "valorProyectado")),
        horizonteDias: aNumero(campo(raw, "horizonteDias")),
        estadoProyectado: campo(raw, "estadoProyectado") || "",
        tendencia: campo(raw, "tendencia") || "sin_datos",
        cambioEsperado: aNumero(campo(raw, "cambioEsperado")),
        riesgo: campo(raw, "riesgo") || "",
        gravedad: campo(raw, "gravedad") || "ninguna",
        margenAlLimite: aNumero(campo(raw, "margenAlLimite")),
        diasHastaSalirRango: aNumero(campo(raw, "diasHastaSalirRango")),
        diasHastaNormalizar: aNumero(campo(raw, "diasHastaNormalizar")),
        proximoControlDias: aNumero(campo(raw, "proximoControlDias")),
        confianza: campo(raw, "confianza") || "baja",
        puntosUsados: aNumero(campo(raw, "puntosUsados")) ?? 0
    };
    return p.valorProyectado === null && !p.riesgo ? null : p;
}

const chipHtml = (texto, clase) => `<span class="walle-chip ${escapeHtml(clase)}">${escapeHtml(texto)}</span>`;
const itemHtml = (titulo, valor, sub) =>
    `<div class="walle-pred-item"><small>${escapeHtml(titulo)}</small><strong>${valor}</strong>${sub ? `<span>${sub}</span>` : ""}</div>`;

const TENDENCIAS = {
    ascendente: ["↗", "Ascendente"], descendente: ["↘", "Descendente"],
    estable: ["→", "Estable"], sin_datos: ["•", "Sin datos"]
};

function renderPrediccionIA(pred) {
    asegurarEstilosWalle();
    estado.prediccion = pred;
    const proyecta = !!pred && pred.tendencia !== "sin_datos" && pred.valorProyectado !== null;
    estado.proyeccion = proyecta
        ? { valor: pred.valorProyectado, etiqueta: "Proy.", color: COLOR_ESTADO[claseEstado(pred.estadoProyectado)] }
        : null;

    let panel = $("panelPrediccionWalleHB");
    if (!pred) { panel?.remove(); return; }

    const contenedor = $("alertasWalleHB");
    if (!contenedor) return;
    if (!panel) {
        panel = document.createElement("div");
        panel.id = "panelPrediccionWalleHB";
        panel.className = "walle-pred";
        const ref = $("textoAlertaWalleHB");
        if (ref) ref.after(panel); else contenedor.appendChild(panel);
    }

    const [flecha, textoTend] = TENDENCIAS[pred.tendencia] || TENDENCIAS.sin_datos;
    const cambio = pred.cambioEsperado;
    const margen = pred.margenAlLimite;
    const riesgoClase = String(pred.riesgo).toLowerCase();
    const items = [];

    items.push(itemHtml("Hb proyectada",
        proyecta ? `${pred.valorProyectado.toFixed(1)} g/dL` : "—",
        proyecta ? `${chipHtml(pred.estadoProyectado, claseEstado(pred.estadoProyectado))} en ~${pred.horizonteDias ?? 30} días`
                 : "Faltan datos para proyectar"));
    items.push(itemHtml("Riesgo", pred.riesgo ? chipHtml(pred.riesgo, riesgoClase) : "—",
        pred.gravedad && pred.gravedad !== "ninguna" ? `Gravedad ${escapeHtml(pred.gravedad)}`
            : (margen !== null && margen >= 0 ? `A ${margen.toFixed(1)} g/dL del límite` : "")));
    items.push(itemHtml("Tendencia", `${flecha} ${textoTend}`,
        proyecta && cambio !== null ? `${cambio > 0 ? "+" : ""}${cambio.toFixed(1)} g/dL esperados` : ""));
    items.push(itemHtml("Confianza", escapeHtml(pred.confianza.charAt(0).toUpperCase() + pred.confianza.slice(1)),
        `${pred.puntosUsados} análisis`));
    if (pred.proximoControlDias !== null) {
        items.push(itemHtml("Próximo control", `~${pred.proximoControlDias} días`, "sugerido"));
    }
    if (pred.diasHastaSalirRango !== null) {
        items.push(itemHtml("Podría salir del rango", `~${pred.diasHastaSalirRango} días`, "si la tendencia continúa"));
    }
    if (pred.diasHastaNormalizar !== null) {
        items.push(itemHtml("Volvería al rango", `~${pred.diasHastaNormalizar} días`, "si la tendencia continúa"));
    }

    panel.innerHTML = `
        <h5>🔮 Proyección de Walle-HB</h5>
        <div class="walle-pred-grid">${items.join("")}</div>
        <p class="walle-pred-nota">Estimación estadística orientativa${pred.confianza === "baja" ? " (confianza baja: registra más controles para afinarla)" : ""}; no reemplaza la valoración médica.</p>`;
}

function mostrarCargaIA() {
    asegurarEstilosWalle();
    const alerta = $("textoAlertaWalleHB");
    if (!alerta) return;
    alerta.innerHTML = '<span class="walle-cargando">⏳ Walle-HB está analizando tu historial…</span>';
    mostrar("alertasWalleHB", "block");
}

function ocultarPanelIA() {
    $("panelPrediccionWalleHB")?.remove();
    estado.prediccion = null;
    estado.proyeccion = null;
    mostrar("alertasWalleHB", "none");
}

// Si Render estaba dormido, C# responde "Procesando...": se vuelve a consultar solo
function programarReintentoIA() {
    if (estado.reintentosIA >= MAX_REINTENTOS_IA) return;
    estado.reintentosIA++;
    clearTimeout(estado.reintentoIA);
    estado.reintentoIA = setTimeout(async () => {
        try {
            const res = await apiFetch("Dashboard/paciente");
            if (!res.ok) return;
            const datos = await res.json();
            const nodo = datos.analisisIA || datos.analisisia;
            if (nodo) renderAnalisisIA(nodo);
        } catch (error) {
            console.error("Reintento de Walle-HB fallido:", error);
        }
    }, REINTENTO_IA_MS);
}

function renderAnalisisIA(iaNode) {
    const estadoIA = String((Array.isArray(iaNode.estado) ? iaNode.estado[0] : iaNode.estado) ?? "");
    const procesando = /^procesando/i.test(estadoIA);
    const conError = /^error/i.test(estadoIA);

    // Alerta principal
    const bruto = iaNode.alertas;
    const mensaje = Array.isArray(bruto) ? (bruto[0] || "") : String(bruto ?? "");
    const alertaDiv = $("textoAlertaWalleHB");
    if (alertaDiv) {
        const cuerpo = escapeHtml(mensaje).replace(/\n/g, "<br>");
        alertaDiv.innerHTML = !mensaje ? ""
            : (procesando || conError) ? cuerpo
            : `<strong>Obtenido del historial de mediciones:</strong><br><br>${cuerpo}`;
    }

    // Recomendaciones
    const lista = $("listaRecomendacionesWalleHB");
    if (lista) {
        const recs = Array.isArray(iaNode.recomendaciones) ? iaNode.recomendaciones : [];
        lista.replaceChildren(...recs.map((rec) => {
            const li = document.createElement("li");
            li.textContent = rec;
            li.className = "item-recommendacion-ia";
            return li;
        }));
    }

    // Predicciones (proyección, riesgo, confianza...)
    renderPrediccionIA(procesando || conError ? null : normalizarPrediccion(campo(iaNode, "prediccion")));

    mostrar("alertasWalleHB", mensaje || estado.prediccion ? "block" : "none");
    procesarFiltroCronologico(estado.filtro);   // redibuja el gráfico con el punto proyectado

    if (procesando) programarReintentoIA(); else estado.reintentosIA = 0;
}

// ----------------------------------------------------------------------------
// Carga principal del dashboard
// ----------------------------------------------------------------------------
async function cargarDashboard() {
    const id = getUserId();
    clearTimeout(estado.reintentoIA);
    estado.reintentosIA = 0;
    mostrarCargaIA();

    try {
        const [, resDashboard, resHistorial] = await Promise.all([
            cargarPaciente(),
            apiFetch("Dashboard/paciente"),
            apiFetch(`Paciente/mihistorial/${id}`)
        ]);

        if (resDashboard.status === 401 || resDashboard.status === 403) {
            alert("Su sesión ha expirado o es inválida.");
            cerrarSesion();
            return;
        }
        if (!resDashboard.ok) throw new Error(`Dashboard/paciente respondió ${resDashboard.status}`);

        if (resHistorial.ok) {
            const h = await resHistorial.json();
            estado.historialCompleto = h.historial || [];
        }

        const datos = await resDashboard.json();
        estado.nombre = datos.nombreCompleto || "Paciente";
        estado.historialDashboard = datos.historial || [];

        if (estado.historialCompleto.length === 0) {
            pintarSinAnalisis();
            inicializarGrafico([], [], []);
            ocultarPanelIA();
            return;
        }

        procesarFiltroCronologico(estado.filtro);

        // Estado base (y rango de referencia real), se redibuja el gráfico con ese rango
        // y luego se pinta el dictamen de Walle-HB encima
        await actualizarEstadoClinico();
        procesarFiltroCronologico(estado.filtro);

        const iaNode = datos.analisisIA || datos.analisisia;
        if (iaNode) renderAnalisisIA(iaNode); else ocultarPanelIA();
    } catch (error) {
        ocultarPanelIA();
        throw error;
    }
}

// ----------------------------------------------------------------------------
// Reporte PDF (impresión)
// ----------------------------------------------------------------------------
function descargarReportePDF() {
    const historial = historialActivo();
    if (!historial.length) {
        alert("No registras análisis clínicos en tu historial para generar el reporte.");
        return;
    }

    // Más reciente primero
    const ordenado = [...historial].sort((a, b) => {
        const fa = parseFecha(leerFecha(a)), fb = parseFecha(leerFecha(b));
        return (fb || 0) - (fa || 0);
    });

    const colores = { estable: "#27ae60", anemia: "#c0392b", poliglobulia: "#d35400" };
    const filas = ordenado.map((r, idx) => {
        const valor = leerHemo(r);
        const { clase, pdf } = clasificarHemoglobina(valor, leerRango(r) || estado.rango);
        const negrita = clase === "estable" ? "" : "font-weight: bold;";
        return `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left;">Medición ${idx + 1}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${escapeHtml(leerFecha(r) || "Sin fecha")}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${valor.toFixed(2)} g/dL</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: ${colores[clase]}; ${negrita}">${pdf}</td>
            </tr>`;
    }).join("");

    const p = estado.prediccion;
    const bloqueWalle = p ? `
            <div class="info-section" style="background-color: #ffffff;">
                <p><strong>Análisis Walle-HB:</strong> riesgo ${escapeHtml(String(p.riesgo || "sin dato").toLowerCase())}, confianza ${escapeHtml(p.confianza)} (${p.puntosUsados} análisis).</p>
                ${p.valorProyectado !== null && p.tendencia !== "sin_datos"
                    ? `<p><strong>Proyección a ${p.horizonteDias ?? 30} días:</strong> ≈ ${p.valorProyectado.toFixed(1)} g/dL (${escapeHtml(p.estadoProyectado)})</p>` : ""}
                ${p.proximoControlDias !== null ? `<p><strong>Próximo control sugerido:</strong> en unos ${p.proximoControlDias} días</p>` : ""}
                <p style="font-size: 11px; color: #64748b;">Estimación estadística orientativa; no reemplaza la valoración médica.</p>
            </div>` : "";

    const ventana = window.open("", "_blank");
    if (!ventana) {
        alert("El navegador bloqueó la ventana del reporte. Permita las ventanas emergentes e inténtelo de nuevo.");
        return;
    }

    const nombre = escapeHtml(estado.nombre || "Paciente Anónimo");
    const tituloArchivo = escapeHtml((estado.nombre || "Paciente").replace(/\s+/g, "_"));

    ventana.document.write(`
        <html>
        <head>
            <title>Reporte_Hemoglobina_${tituloArchivo}</title>
            <style>
                body { font-family: 'Helvetica', Arial, sans-serif; margin: 0; padding: 0; color: #334155; }
                .header { background-color: #0f172a; color: white; padding: 25px 20px; }
                .header h1 { margin: 0; font-size: 24px; font-weight: bold; }
                .info-section { padding: 20px; font-size: 13px; line-height: 1.6; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; }
                .info-section p { margin: 4px 0; }
                .tabla-contenedor { padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
                th { background-color: #2980b9; color: white; padding: 12px 10px; font-weight: bold; text-align: center; }
                @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            </style>
        </head>
        <body>
            <div class="header"><h1>SISTEMA HB - REPORTE CLÍNICO</h1></div>
            <div class="info-section">
                <p><strong>Paciente:</strong> ${nombre}</p>
                <p><strong>Correo Electrónico:</strong> ${escapeHtml(localStorage.getItem("usuario_correo") || "Registrado en el sistema")}</p>
                <p><strong>Fecha de Emisión:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Total de Análisis Procesados:</strong> ${historial.length}</p>
            </div>
            ${bloqueWalle}
            <div class="tabla-contenedor">
                <table>
                    <thead>
                        <tr>
                            <th style="text-align: left;">Secuencia</th>
                            <th>Fecha del Análisis</th>
                            <th>Nivel Hemoglobina</th>
                            <th>Evaluación Diagnóstica</th>
                        </tr>
                    </thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
            <script>
                window.onload = function () {
                    window.print();
                    setTimeout(function () { window.close(); }, 500);
                };
            <\/script>
        </body>
        </html>`);
    ventana.document.close();
}

// ----------------------------------------------------------------------------
// Modal de análisis y telemetría desde Firebase
// ----------------------------------------------------------------------------
function limpiarVigilanteSensor() {
    clearInterval(estado.sensor.intervalo);
    clearTimeout(estado.sensor.timeout);
    estado.sensor.intervalo = null;
    estado.sensor.timeout = null;
}

function abrirModalAnalisis() {
    limpiarVigilanteSensor();
    estado.medicion = null;
    cargarObservacionesEnSelect();

    $("modalAnalisis")?.classList.add("active");
    mostrar("inputSection", "flex");       // es flex en el HTML (antes se ponía "block")
    mostrar("loaderSection", "none");
    mostrar("iconoCarga", "none");
    mostrar("btnGuardarSQL", "none");

    const txt = $("txtSensorId");
    if (txt) txt.value = "";

    setTexto("modalTitulo", "Vincular Dispositivo Médico");
    setTexto("modalMensaje", "Por favor, ingrese manualmente el código identificador de su sensor biométrico (ej. esp32_sala_1) para iniciar.");
}

function cerrarModalAnalisis() {
    limpiarVigilanteSensor();
    $("modalAnalisis")?.classList.remove("active");
    estado.medicion = null;
}

const urlNodoSensor = (sensorId) =>
    `${FIREBASE_URL}dispositivos_activos/${encodeURIComponent(sensorId.replace(/:/g, ""))}.json`;

async function iniciarVinculacionManual() {
    const sensorId = ($("txtSensorId")?.value || "").trim();
    if (!sensorId) {
        alert("Por favor, ingrese un código identificador válido.");
        return;
    }

    const urlNodo = urlNodoSensor(sensorId);

    // Restricción: el sensor no debe estar en uso por otro usuario
    try {
        const verificar = await fetch(`${urlNodo}?nocache=${Date.now()}`, { method: "GET", cache: "no-store" });
        if (verificar.ok && (await verificar.json()) !== null) {
            alert("⚠️ El dispositivo sensor ya se encuentra en uso por otro usuario. Por favor, espere a que termine o intente con otra MAC.");
            return;
        }
    } catch (error) {
        console.error("Error al verificar la disponibilidad del sensor:", error);
        alert("Hubo un error de conexión al verificar el estado del dispositivo.");
        return;
    }

    mostrar("inputSection", "none");
    mostrar("loaderSection", "flex");
    mostrar("iconoCarga", "block");
    mostrar("loaderTexto", "block");
    setTexto("loaderTexto", "Conectando...");
    setTexto("modalTitulo", "Estableciendo Enlace");
    setTexto("modalMensaje", `Buscando canal activo para el sensor: ${sensorId}...`);

    estado.sensor.timeout = setTimeout(() => {
        setTexto("loaderTexto", "Vinculación completa, porfavor utilice el dispositivo");
        setTexto("modalMensaje", "Sincronización establecida. Realice la toma física de la muestra con el lector de hardware.");
        escucharCambiosFirebase(sensorId, urlNodo);
    }, 3000);
}

function escucharCambiosFirebase(sensorId, urlNodo) {
    limpiarVigilanteSensor();
    let consultando = false;

    estado.sensor.intervalo = setInterval(async () => {
        if (consultando) return; // evita consultas superpuestas
        consultando = true;
        try {
            const resp = await fetch(`${urlNodo}?nocache=${Date.now()}`, { method: "GET", cache: "no-store" });
            if (!resp.ok) return;

            const hw = await resp.json();
            if (!hw || hw.mensaje !== "Exito") return;

            limpiarVigilanteSensor();

            const hemoglobina = parseFloat(hw.hemoglobina);
            const temperatura = parseFloat(hw.temperatura);
            if (isNaN(hemoglobina) || isNaN(temperatura)) {
                mostrar("iconoCarga", "none");
                setTexto("loaderTexto", "Datos inválidos");
                setTexto("modalMensaje", "El sensor envió valores no numéricos. Inténtelo de nuevo.");
                return;
            }

            setTexto("loaderTexto", "Analisis terminado");
            estado.medicion = {
                valor_hemoglobina: hemoglobina,
                temperatura: temperatura,
                sensor_id: sensorId,
                timestamp: hw.timestamp || Math.floor(Date.now() / 1000)
            };

            // Limpiar el nodo del sensor para dejarlo libre
            fetch(urlNodo, { method: "DELETE" }).catch((e) =>
                console.error("Error al intentar limpiar el nodo en Firebase:", e));

            const m = $("modalMensaje");
            if (m) {
                m.innerHTML = `
<div style="text-align: left; background: #f8fafc; padding: 14px; border-radius: 10px; border: 1px solid #e2e8f0; margin-top: 10px;">
<p style="margin: 4px 0;"><strong>📡 Sensor validado:</strong> ${escapeHtml(sensorId)}</p>
<p style="margin: 4px 0; color: #2563eb;"><strong>🩸 Hemoglobina capturada:</strong> ${hemoglobina.toFixed(2)} g/dL</p>
<p style="margin: 4px 0; color: #ef4444;"><strong>🌡️ Temperatura corporal:</strong> ${temperatura.toFixed(1)} °C</p>
</div>
<p style="margin-top: 15px; font-weight: 600; color: var(--text-main);">Confirme la veracidad de la muestra para guardar de manera definitiva.</p>`;
            }

            mostrar("iconoCarga", "none");
            mostrar("btnGuardarSQL", "block");
        } catch (error) {
            console.error("Falla de comunicación con el REST de Firebase:", error);
        } finally {
            consultando = false;
        }
    }, POLLING_MS);

    // Tiempo máximo de espera del hardware
    estado.sensor.timeout = setTimeout(() => {
        if (estado.medicion) return;
        limpiarVigilanteSensor();
        mostrar("iconoCarga", "none");
        setTexto("loaderTexto", "Tiempo agotado");
        setTexto("modalMensaje", "No se detectó el envío de datos desde el sensor. Inténtelo de nuevo.");
    }, TIMEOUT_SENSOR_MS);
}

async function ejecutarGuardadoDefinitivo() {
    const medicion = estado.medicion;
    if (!medicion) return;

    const idObservacion = $("cboObservaciones")?.value || 0;

    mostrar("btnGuardarSQL", "none");
    mostrar("iconoCarga", "block");
    setTexto("loaderTexto", "Guardando...");

    try {
        const respuesta = await apiFetch(`Dashboard/guardarAnalisis/${idObservacion}`, {
            method: "POST",
            body: JSON.stringify({
                valorHemoglobina: medicion.valor_hemoglobina,
                temperatura: medicion.temperatura,
                fechaAnalisis: new Date().toISOString()
            })
        });

        if (respuesta.ok) {
            setTexto("loaderTexto", "¡Sincronizado!");
            setTexto("modalMensaje", "Análisis registrado de manera permanente en el servidor de la clínica.");
            setTimeout(() => {
                cerrarModalAnalisis();
                location.reload();
                cargarDashboard().catch((e) => console.error("Error al refrescar el dashboard:", e)); // sin recargar la página
            }, 2000);
        } else {
            mostrar("iconoCarga", "none");
            alert("No se pudo completar el almacenamiento de la medición en la base de datos central.");
            mostrar("btnGuardarSQL", "block");
        }
    } catch (error) {
        console.error("Error al conectar con el backend de C#:", error);
        mostrar("iconoCarga", "none");
        mostrar("btnGuardarSQL", "block");
    }
}

// ----------------------------------------------------------------------------
// Compartir reporte por correo
// ----------------------------------------------------------------------------
function abrirModalEnvioCorreos() {
    const modal = $("modalEnvioCorreos");
    if (!modal) {
        console.error("No se encontró el elemento HTML con id 'modalEnvioCorreos'");
        return;
    }
    modal.classList.add("active");
    cargarMedicosAsociados();
}

function cerrarModalEnvioCorreos() {
    $("modalEnvioCorreos")?.classList.remove("active");
}

async function cargarMedicosAsociados() {
    const contenedor = $("listaMedicosReporte");
    if (!contenedor) return;

    try {
        const respuesta = await apiFetch(`Paciente/mismedicos/${getUserId()}`);
        if (!respuesta.ok) throw new Error(`Error en el servidor: ${respuesta.status}`);

        const medicos = await respuesta.json();
        if (!medicos || medicos.length === 0) {
            contenedor.innerHTML = "<div style='text-align:center; padding:10px;'>No se encontraron médicos asociados.</div>";
            return;
        }

        contenedor.innerHTML = medicos.map((m) => {
            const nombre = `${m.nombre || "Sin Nombre"} ${m.paterno || ""} ${m.materno || ""}`.trim();
            const especialidad = m.especialidad || "Sin Especialidad";
            const correo = m.correo?.correoElectronico || "Sin Correo";
            return `
            <div style="border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:10px; background:#f8fafc; text-align:left;">
                <strong>Dr(a). ${escapeHtml(nombre)}</strong><br>
                <small style="color:#64748b;">${escapeHtml(especialidad)}</small><br>
                <small style="color:#0f172a; font-weight:500;">${escapeHtml(correo)}</small><br><br>
                <button class="btn btn-primary btn-enviar-reporte" data-correo="${escapeHtml(correo)}">Enviar Reporte</button>
            </div>`;
        }).join("");
    } catch (error) {
        console.error("Error en cargarMedicosAsociados:", error);
        contenedor.innerHTML = "<div style='color:red; text-align:center; padding:10px;'>Error al cargar médicos. Verifique su conexión o sesión.</div>";
    }
}

function enviarCorreoPersonalizado() {
    const correo = ($("txtCorreoPersonalizado")?.value || "").trim();
    if (!correo) {
        alert("Ingrese un correo.");
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        alert("Ingrese un correo electrónico válido.");
        return;
    }
    const mensajeConfirmacion = `¿Está seguro de que desea enviar el reporte clínico al siguiente destinatario?\n\n📩 Correo: ${correo}`;
    if (window.confirm(mensajeConfirmacion)) {
        enviarReporteCorreo(correo);
    } else {
        // Si el usuario presiona "Cancelar", se detiene la ejecución
        console.log("Envío de correo cancelado por el usuario.");
    }
}

async function enviarReporteCorreo(correo) {
    if (correo === "Sin Correo") {
        alert("Este médico no cuenta con un correo electrónico registrado.");
        return;
    }

    try {
        const respuesta = await apiFetch(
            `Email/enviar-reporte?id_usuario=${encodeURIComponent(getUserId())}&correo_electronico=${encodeURIComponent(correo)}`,
            { method: "POST" }
        );
        if (!respuesta.ok) throw new Error(`Error al enviar: ${respuesta.status}`);

        const datos = await respuesta.json();
        alert(datos.mensaje || "Reporte enviado con éxito.");
    } catch (error) {
        console.error("Error en enviarReporteCorreo:", error);
        alert("No se pudo enviar el reporte. Inténtelo más tarde.");
    }
}

// ----------------------------------------------------------------------------
// Inicialización
// ----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
    $("btnCerrarSesion")?.addEventListener("click", cerrarSesion);

    // Filtros de tiempo (delegación de eventos)
    document.querySelector(".filtros-botones")?.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-filtro");
        if (btn && btn.dataset.filtro) procesarFiltroCronologico(btn.dataset.filtro);
    });

    // Botones "Enviar Reporte" de la lista de médicos (delegación de eventos)
    $("listaMedicosReporte")?.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-enviar-reporte");
        if (btn) enviarReporteCorreo(btn.dataset.correo);
    });

    // Redibujar gráficos al cambiar el tamaño de la ventana
    let temporizadorResize = null;
    window.addEventListener("resize", () => {
        clearTimeout(temporizadorResize);
        temporizadorResize = setTimeout(() => {
            graficoHemoInstancia?.redibujar();
            graficoTempInstancia?.redibujar();
        }, 150);
    });

    if (!getToken()) {
        alert("Acceso no autorizado. Por favor, inicie sesión nuevamente.");
        window.location.href = "../index.html";
        return;
    }

    try {
        await cargarDashboard();
    } catch (error) {
        console.error("Error crítico detectado en la inicialización:", error);
    }
});