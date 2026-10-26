// Estadísticas generales: filtros cruzados, KPIs, dos gráficos de línea (canvas) y tabla detallada.
import { $, escapeHtml, campo, getToken, parseFecha, formatearFecha } from "./utils.js";
import { api } from "./api.js";

let registros = [];   // historial ya normalizado
let ultimos = [];     // registros visibles con los filtros actuales (para volver a dibujar al cambiar el tamaño)

const FILTROS = ["fAnio", "fCiudad", "fGenero", "fEdad", "fEstado", "fTermica"];

// ---------------------------------------------------------------------------
// Normalización: se calcula una sola vez, sin modificar lo que llega de la API
// ---------------------------------------------------------------------------
function normalizar(item) {
    const rango = campo(item, "idRangoHemoglobinaNavigation") ?? {};
    const ciudad = campo(rango, "idCiudadNavigation") ?? {};
    const genero = campo(rango, "idGeneroNavigation") ?? {};
    const edad = campo(rango, "idEdadNavigation") ?? {};

    const hb = parseFloat(campo(item, "valorHemoglobina") ?? 0) || 0;
    const min = parseFloat(campo(rango, "valorMin") ?? 0) || 0;
    const max = parseFloat(campo(rango, "valorMax") ?? 100) || 100;
    const fecha = parseFecha(campo(item, "fechaAnalisis"));

    let diagnostico = "Estable";
    if (hb < min) diagnostico = "Anemia";
    else if (hb > max) diagnostico = "Poliglobulia";

    return {
        idUsuario: campo(item, "idUsuario"),
        fecha,
        hb,
        temperatura: parseFloat(campo(item, "temperatura") ?? 0) || 0,
        edad: Number(campo(edad, "edad") ?? 0) || 0,
        edadTexto: campo(edad, "edad") ?? "S/D",
        ciudad: campo(ciudad, "nombre") ?? "",
        altitud: parseFloat(campo(ciudad, "altitud") ?? 0) || 0,
        genero: campo(genero, "nombre") ?? "",
        diagnostico
    };
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------
function llenarOpciones(selectId, valores, formato = (v) => v) {
    const select = $(selectId);
    const actual = select.value;
    select.querySelectorAll("option:not([value='todos'])").forEach((o) => o.remove());
    for (const v of valores) {
        const opcion = document.createElement("option");
        opcion.value = v;
        opcion.textContent = formato(v);
        select.appendChild(opcion);
    }
    select.value = [...select.options].some((o) => o.value === actual) ? actual : "todos";
}

function prepararFiltros() {
    const anios = [...new Set(registros.map((r) => r.fecha?.getFullYear()).filter(Boolean))].sort((a, b) => b - a);
    llenarOpciones("fAnio", anios.map(String));

    const ciudades = new Map();
    registros.forEach((r) => { if (r.ciudad) ciudades.set(r.ciudad, r.altitud); });
    llenarOpciones("fCiudad", [...ciudades.keys()].sort(), (c) => `${c} (${Math.round(ciudades.get(c))} m)`);
}

function pasaFiltros(r, f) {
    if (f.fAnio !== "todos" && String(r.fecha?.getFullYear()) !== f.fAnio) return false;
    if (f.fCiudad !== "todos" && r.ciudad !== f.fCiudad) return false;
    if (f.fGenero !== "todos" && r.genero.toLowerCase() !== f.fGenero.toLowerCase()) return false;

    if (f.fEdad === "infantil" && r.edad > 12) return false;
    if (f.fEdad === "adolescente" && (r.edad <= 12 || r.edad > 17)) return false;
    if (f.fEdad === "adulto" && r.edad < 18) return false;

    if (f.fEstado !== "todos" && r.diagnostico !== f.fEstado) return false;

    if (f.fTermica === "normal" && (r.temperatura < 36.0 || r.temperatura > 37.3)) return false;
    if (f.fTermica === "fiebre" && r.temperatura <= 37.3) return false;
    if (f.fTermica === "hipo" && r.temperatura >= 36.0) return false;
    return true;
}

function aplicarFiltros() {
    const valores = Object.fromEntries(FILTROS.map((id) => [id, $(id).value]));
    const visibles = registros
        .filter((r) => pasaFiltros(r, valores))
        .sort((a, b) => (a.fecha ?? 0) - (b.fecha ?? 0));
    pintar(visibles);
}

function restablecerFiltros() {
    FILTROS.forEach((id) => { $(id).value = "todos"; });
    aplicarFiltros();
}

// ---------------------------------------------------------------------------
// Pintado
// ---------------------------------------------------------------------------
const BADGES = { Anemia: "badge-anemia", Poliglobulia: "badge-poliglobulia", Estable: "badge-normal" };

function pintar(datos) {
    ultimos = datos;
    const conteo = { Anemia: 0, Poliglobulia: 0, Estable: 0 };
    datos.forEach((r) => { conteo[r.diagnostico]++; });

    $("kpiTotal").textContent = datos.length;
    $("kpiAnemia").textContent = conteo.Anemia;
    $("kpiEstable").textContent = conteo.Estable;
    $("kpiPoliglobulia").textContent = conteo.Poliglobulia;

    $("tablaResultados").innerHTML = datos.length === 0
        ? '<tr class="fila-mensaje"><td colspan="9">Ninguna muestra médica registrada coincide con los filtros establecidos.</td></tr>'
        : datos.map((r) => `
            <tr>
                <td><strong>#${escapeHtml(r.idUsuario ?? "S/D")}</strong></td>
                <td>${formatearFecha(r.fecha)}</td>
                <td class="negrita">${r.hb.toFixed(2)} g/dL</td>
                <td>${r.temperatura.toFixed(1)} °C</td>
                <td>${escapeHtml(r.edadTexto)} años</td>
                <td>${escapeHtml(r.ciudad || "S/D")}</td>
                <td>${r.altitud.toFixed(0)} msnm</td>
                <td>${escapeHtml(r.genero || "S/D")}</td>
                <td><span class="badge ${BADGES[r.diagnostico]}">${r.diagnostico}</span></td>
            </tr>`).join("");

    dibujarGraficos();
}

// ---------------------------------------------------------------------------
// Gráficos de línea en canvas (sin librerías; nítidos en pantallas de alta densidad)
// ---------------------------------------------------------------------------
function dibujarLinea(canvasId, etiquetas, valores, { min, max, color, sufijo }) {
    const canvas = $(canvasId);
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const ancho = canvas.clientWidth || 300;
    const alto = 240;
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ancho, alto);
    ctx.textBaseline = "alphabetic";

    if (valores.length === 0) {
        ctx.fillStyle = "#64748b";
        ctx.font = "13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("No existen registros bajo este criterio de búsqueda", ancho / 2, alto / 2);
        return;
    }

    const margen = { izq: 38, der: 16, arr: 24, aba: 40 };
    const w = ancho - margen.izq - margen.der;
    const h = alto - margen.arr - margen.aba;

    // Si algún valor se sale de la escala fija, se amplía para no dibujar fuera del área.
    const lo = Math.min(min, ...valores);
    const hi = Math.max(max, ...valores);
    const yDe = (v) => margen.arr + h - ((v - lo) / (hi - lo)) * h;

    // Rejilla y eje Y
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#f1f5f9";
    ctx.fillStyle = "#64748b";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
        const v = lo + ((hi - lo) / 4) * i;
        const y = yDe(v);
        ctx.beginPath();
        ctx.moveTo(margen.izq, y);
        ctx.lineTo(ancho - margen.der, y);
        ctx.stroke();
        ctx.fillText(v.toFixed(1), margen.izq - 6, y + 4);
    }

    const puntos = valores.map((v, i) => ({
        x: margen.izq + (valores.length > 1 ? (i / (valores.length - 1)) * w : w / 2),
        y: yDe(v),
        v
    }));

    // Cuántos rótulos caben sin encimarse (≈ 46 px por etiqueta)
    const cadaN = Math.max(1, Math.ceil(valores.length / Math.max(1, Math.floor(w / 46))));

    // Línea
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    puntos.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();

    // Nodos, valores y fechas
    ctx.textAlign = "center";
    puntos.forEach((p, i) => {
        ctx.beginPath();
        ctx.fillStyle = "#fff";
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        if (i % cadaN === 0) {
            ctx.fillStyle = "#1e293b";
            ctx.font = "bold 10px sans-serif";
            ctx.fillText(p.v.toFixed(1) + sufijo, p.x, p.y - 10);
            ctx.fillStyle = "#64748b";
            ctx.font = "10px sans-serif";
            ctx.fillText(etiquetas[i], p.x, alto - 16);
        }
    });
}

function dibujarGraficos() {
    const etiquetas = ultimos.map((r) => (r.fecha ? `${r.fecha.getDate()}/${r.fecha.getMonth() + 1}` : "S/D"));
    dibujarLinea("graficoHemoglobina", etiquetas, ultimos.map((r) => r.hb), { min: 8, max: 22, color: "#818cf8", sufijo: "" });
    dibujarLinea("graficoTemperatura", etiquetas, ultimos.map((r) => r.temperatura), { min: 30, max: 42, color: "#f97316", sufijo: "°" });
}

// ---------------------------------------------------------------------------
// Pop-up de la tabla
// ---------------------------------------------------------------------------
function abrirTabla() {
    $("modalTablaAnalitica").classList.add("abierto");
    document.body.style.overflow = "hidden";
    $("btnCerrarTabla").focus();
}

function cerrarTabla() {
    $("modalTablaAnalitica").classList.remove("abierto");
    document.body.style.overflow = "";
    $("btnAbrirTabla").focus();
}

// ---------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
    FILTROS.forEach((id) => $(id).addEventListener("change", aplicarFiltros));
    $("btnRestablecer").addEventListener("click", restablecerFiltros);
    $("btnAbrirTabla").addEventListener("click", abrirTabla);
    $("btnCerrarTabla").addEventListener("click", cerrarTabla);
    $("modalTablaAnalitica").addEventListener("click", (e) => { if (e.target.id === "modalTablaAnalitica") cerrarTabla(); });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && $("modalTablaAnalitica").classList.contains("abierto")) cerrarTabla();
    });

    // Al girar el celular o cambiar el tamaño de la ventana se vuelven a dibujar los gráficos.
    let temporizador;
    window.addEventListener("resize", () => {
        clearTimeout(temporizador);
        temporizador = setTimeout(dibujarGraficos, 150);
    });

    const resp = await api("Estadistica/historial", { auth: Boolean(getToken()) });
    if (!resp.ok || !Array.isArray(resp.datos)) {
        const texto = resp.status === 0
            ? "Fallo de conexión con el servidor."
            : "Error al obtener el historial de registros médicos.";
        $("tablaResultados").innerHTML = `<tr class="fila-mensaje"><td colspan="9" class="texto-error">${texto}</td></tr>`;
        dibujarGraficos();
        return;
    }

    registros = resp.datos.map(normalizar);
    prepararFiltros();
    aplicarFiltros();
});
