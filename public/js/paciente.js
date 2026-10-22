/* ============================================================================
 * paciente.js  (versión corregida y optimizada)
 * Requiere config.js con las constantes globales: API_URL y FIREBASE_URL
 * ========================================================================== */
"use strict";

// ----------------------------------------------------------------------------
// Constantes y estado
// ----------------------------------------------------------------------------
const RANGO_HB_DEFECTO = { min: 14.8, max: 18.8 };
const POLLING_MS = 2000;
const TIMEOUT_SENSOR_MS = 60000;

const estado = {
    historialCompleto: [],     // Paciente/mihistorial
    historialDashboard: [],    // Dashboard/paciente
    nombre: "Paciente",
    filtro: "todos",
    rango: { ...RANGO_HB_DEFECTO },
    medicion: null,            // medición temporal del sensor (antes de guardar)
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

function clasificarHemoglobina(valor) {
    if (valor < estado.rango.min) return { clase: "anemia", texto: "ALERTA DE ANEMIA", pdf: "Alerta de Anemia" };
    if (valor > estado.rango.max) return { clase: "poliglobulia", texto: "ALERTA DE POLIGLOBULIA", pdf: "Alerta de Poliglobulia" };
    return { clase: "estable", texto: "FISIOLÓGICAMENTE ESTABLE", pdf: "Normal (Estable)" };
}

// ----------------------------------------------------------------------------
// Gráfico de línea simple en canvas (sin librerías)
// ----------------------------------------------------------------------------
class MiniChartSingleLine {
    constructor(canvasId, minVal, maxVal, color, esTemp) {
        this.canvas = $(canvasId);
        this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
        this.min = minVal;
        this.max = maxVal;
        this.color = color;
        this.esTemp = esTemp;
        this.ultimo = null; // últimos datos, para redibujar al cambiar el tamaño
    }

    redibujar() {
        if (this.ultimo) this.render(this.ultimo[0], this.ultimo[1]);
    }

    render(etiquetas, datos) {
        this.ultimo = [etiquetas, datos];
        const { canvas, ctx } = this;
        if (!canvas || !ctx) return;

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
        const rango = this.max - this.min;

        // Rejilla y escala del eje Y
        ctx.strokeStyle = "#f1f5f9";
        ctx.lineWidth = 1;
        ctx.font = "11px sans-serif";
        for (let l = 0; l <= 4; l++) {
            const valor = this.min + (rango / 4) * l;
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

        const n = datos.length;
        const puntos = datos.map((val, idx) => {
            const enRango = Math.min(Math.max(val, this.min), this.max);
            return {
                x: izq + (n > 1 ? (idx / (n - 1)) * anchoUtil : anchoUtil / 2),
                y: arriba + altoUtil - ((enRango - this.min) / rango) * altoUtil,
                v: val
            };
        });

        // Línea
        ctx.beginPath();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        puntos.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();

        // Nodos y valores
        puntos.forEach((p) => {
            ctx.beginPath();
            ctx.fillStyle = "#ffffff";
            ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = "#1e293b";
            ctx.font = "bold 10px sans-serif";
            ctx.fillText(p.v.toFixed(1) + (this.esTemp ? "°" : ""), p.x - 10, p.y - 10);
        });

        // Eje X (se omiten rótulos si hay demasiados para evitar solapamiento)
        const maxEtiquetas = Math.max(1, Math.floor(anchoUtil / 45));
        const paso = Math.ceil(n / maxEtiquetas);
        ctx.fillStyle = "#64748b";
        ctx.font = "10px sans-serif";
        etiquetas.forEach((texto, idx) => {
            if (idx % paso !== 0) return;
            const p = puntos[idx];
            ctx.save();
            ctx.translate(p.x, alto - 15);
            ctx.rotate(-0.15);
            ctx.fillText(texto, -20, 10);
            ctx.restore();
        });
    }
}

function inicializarGrafico(etiquetas, valoresHemo, valoresTemp) {
    if (!graficoHemoInstancia) {
        graficoHemoInstancia = new MiniChartSingleLine("graficoHemoglobina", 8, 18, "#818cf8", false);
    }
    if (!graficoTempInstancia) {
        graficoTempInstancia = new MiniChartSingleLine("graficoTemperatura", 35, 41, "#f97316", true);
    }
    graficoHemoInstancia.render(etiquetas, valoresHemo);
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
        console.log(datos);
        const ultimo = datos[datos.length - 1];
        console.log(ultimo);
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
function renderAnalisisIA(iaNode, ultimo) {
    const hemo = leerHemo(ultimo);
    console.log(hemo);
    const temp = ultimo.temperatura ?? ultimo.Temperatura ?? "S/D";

    const estadoIA = Array.isArray(iaNode.estado) ? iaNode.estado[0] : iaNode.estado;
    console.log(estadoIA);
    if (estadoIA) {
        const clave = String(estadoIA).toLowerCase();
        const clase = clave === "anemia" ? "anemia" : clave === "poliglobulia" ? "poliglobulia" : "estable";
    }

    // Alertas
    const alertaDiv = $("textoAlertaWalleHB");
    if (alertaDiv && iaNode.alertas) {
        const mensaje = Array.isArray(iaNode.alertas) ? (iaNode.alertas[0] || "") : String(iaNode.alertas);
        if (mensaje.length > 0) {
            alertaDiv.innerHTML = `<strong>Obtenido del historial de mediciones:</strong><br><br>${escapeHtml(mensaje).replace(/\n/g, "<br>")}`;
            mostrar("alertasWalleHB", "block");
        }
    }

    // Recomendaciones
    const lista = $("listaRecomendacionesWalleHB");
    if (lista && Array.isArray(iaNode.recomendaciones)) {
        lista.replaceChildren(...iaNode.recomendaciones.map((rec) => {
            const li = document.createElement("li");
            li.textContent = rec;
            li.className = "item-recommendacion-ia";
            return li;
        }));
    }
}

// ----------------------------------------------------------------------------
// Carga principal del dashboard
// ----------------------------------------------------------------------------
async function cargarDashboard() {
    const id = getUserId();

    const [, resDashboard, resHistorial] = await Promise.all([
        cargarPaciente(),
        apiFetch("Dashboard/paciente"),
        apiFetch(`Paciente/mihistorial/${id}`)
    ]);

    if (!resDashboard.ok) {
        alert("Su sesión ha expirado o es inválida.");
        cerrarSesion();
        return;
    }

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
        return;
    }

    procesarFiltroCronologico(estado.filtro);

    // Estado base (y rango de referencia real) y luego el dictamen de la IA encima
    await actualizarEstadoClinico();

    const iaNode = datos.analisisIA || datos.analisisia;
    if (iaNode) renderAnalisisIA(iaNode, registroMasReciente(estado.historialCompleto));
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
        const { clase, pdf } = clasificarHemoglobina(valor);
        const negrita = clase === "estable" ? "" : "font-weight: bold;";
        return `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left;">Medición ${idx + 1}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${escapeHtml(leerFecha(r) || "Sin fecha")}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${valor.toFixed(2)} g/dL</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: ${colores[clase]}; ${negrita}">${pdf}</td>
            </tr>`;
    }).join("");

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
                cargarDashboard().catch((e) => console.error("Error al refrescar el dashboard:", e)); // sin recargar la página
            }, 2000);
            location.reload();
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
