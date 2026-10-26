// Panel del administrador: métricas globales, pacientes y cuerpo médico.
import { $, escapeHtml, getUserId, cerrarSesion, exigirSesion, formatearFecha, normalizar, debounce } from "./utils.js";
import { api, sesionInvalida } from "./api.js";
import { activarMenuHamburguesa } from "./ui.js";

let pacientes = [];
let medicos = [];

const nombreDe = (dp = {}) => [dp.nombre, dp.paterno, dp.materno, dp.apellido].filter(Boolean).join(" ").trim();
const mensajeFila = (columnas, texto) => `<tr class="fila-mensaje"><td colspan="${columnas}">${escapeHtml(texto)}</td></tr>`;

// ---------------------------------------------------------------------------
// Carga
// ---------------------------------------------------------------------------
async function cargarAdministrador() {
    const resp = await api(`Administrador/MisDatos/${getUserId()}`);
    if (!resp.ok) return;
    const u = resp.datos?.usuario ?? resp.datos?.persona ?? {};
    const nombre = nombreDe(u);
    $("txtAdmin").textContent = nombre ? `Bienvenido, ${nombre}` : "Bienvenido, Administrador";
}

async function cargarDashboard() {
    const resp = await api("Dashboard/administrador");
    if (sesionInvalida(resp)) {
        alert("Su sesión administrativa expiró o no es válida.");
        return cerrarSesion();
    }
    if (!resp.ok) {
        const texto = resp.status === 0 ? "No se pudo establecer conexión con el servidor central." : "No se pudieron cargar los datos.";
        $("tbodyPacientes").innerHTML = mensajeFila(5, texto);
        $("tbodyMedicos").innerHTML = mensajeFila(5, texto);
        return;
    }

    const datos = resp.datos ?? {};
    const m = datos.metricasGlobales ?? {};
    $("lblTotalPacientes").textContent = m.totalPacientes ?? 0;
    $("lblTotalMedicos").textContent = m.totalMedicos ?? 0;
    $("lblAlertasRiesgo").textContent = m.alertasRiesgo ?? 0;

    pacientes = datos.pacientes ?? [];
    medicos = datos.medicos ?? [];
    pintar();
}

// ---------------------------------------------------------------------------
// Tablas (se vuelven a pintar al buscar)
// ---------------------------------------------------------------------------
function pintar() {
    const q = normalizar($("buscadorGeneral").value);
    pintarPacientes(pacientes.filter((p) => coincide(p.datosPersonales, q)));
    pintarMedicos(medicos.filter((m) => coincide(m.datosPersonales, q)));
}

function coincide(dp = {}, q) {
    return !q || normalizar(`${nombreDe(dp)} ${dp.correo ?? ""}`).includes(q);
}

function pintarPacientes(lista) {
    const tbody = $("tbodyPacientes");
    if (lista.length === 0) {
        tbody.innerHTML = mensajeFila(5, "No se encontraron pacientes que coincidan.");
        return;
    }

    tbody.innerHTML = lista.map((p) => {
        const dp = p.datosPersonales ?? {};
        const indice = pacientes.indexOf(p);
        const nHistorial = (p.historialHemoglobina ?? []).length;
        const nMedicos = (p.medicosAsignados ?? []).length;
        return `
        <tr>
            <td data-label="Paciente"><strong>${escapeHtml(nombreDe(dp) || "Paciente sin nombre")}</strong></td>
            <td data-label="Contacto">
                <div class="celda-contacto">
                    <div>${escapeHtml(dp.correo || "Sin correo")}</div>
                    <small>Nacimiento: ${dp.fechaNacimiento ? formatearFecha(dp.fechaNacimiento) : "No registrada"}</small>
                </div>
            </td>
            <td data-label="Género">${escapeHtml(dp.genero || "N/A")}</td>
            <td data-label="Sangre"><span class="badge-blood">${escapeHtml(p.tipoSangre || "--")}</span></td>
            <td data-label="Acciones">
                <div class="acciones">
                    <button class="btn-action" data-medicos="${indice}">Médicos (${nMedicos})</button>
                    <button class="btn-action btn-oscuro" data-historial="${indice}">Historial (${nHistorial})</button>
                </div>
            </td>
        </tr>`;
    }).join("");
}

function pintarMedicos(lista) {
    const tbody = $("tbodyMedicos");
    if (lista.length === 0) {
        tbody.innerHTML = mensajeFila(5, "No se encontraron médicos que coincidan.");
        return;
    }

    tbody.innerHTML = lista.map((m) => {
        const dp = m.datosPersonales ?? {};
        const especialidades = (m.especialidades ?? []).length
            ? m.especialidades.map((e) => `<span class="chip-esp">${escapeHtml(e)}</span>`).join("")
            : '<span class="texto-suave">General / Ninguna</span>';
        return `
        <tr>
            <td data-label="Médico"><strong>Dr(a). ${escapeHtml(nombreDe(dp))}</strong></td>
            <td data-label="Correo" class="texto-suave">${escapeHtml(dp.correo || "Sin correo")}</td>
            <td data-label="Fecha nac.">${dp.fechaNacimiento ? formatearFecha(dp.fechaNacimiento) : "N/A"}</td>
            <td data-label="Especialidades"><div class="chips-esp">${especialidades}</div></td>
            <td data-label="A cargo"><span class="total-cargo">${m.totalPacientesACargo ?? 0}</span></td>
        </tr>`;
    }).join("");
}

// ---------------------------------------------------------------------------
// Modales
// ---------------------------------------------------------------------------
const abrirModal = (id) => $(id).classList.add("show");
const cerrarModal = (id) => $(id).classList.remove("show");

function mostrarHistorial(paciente) {
    $("modalHistorialTitulo").textContent = `Historial clínico: ${nombreDe(paciente.datosPersonales) || "Paciente"}`;
    const historial = [...(paciente.historialHemoglobina ?? [])]
        .sort((a, b) => new Date(b.fechaAnalisis) - new Date(a.fechaAnalisis));

    $("modalHistorialCuerpo").innerHTML = historial.length === 0
        ? mensajeFila(3, "Este paciente no registra análisis de laboratorio.")
        : historial.map((h) => {
            const r = h.rangoReferencia ?? {};
            return `
            <tr>
                <td data-label="Fecha">${h.fechaAnalisis ? formatearFecha(h.fechaAnalisis) : "Sin fecha"}</td>
                <td data-label="Valor" class="valor-hb">${escapeHtml(h.valorHemoglobina ?? "0.00")} g/dL</td>
                <td data-label="Referencia" class="texto-suave">${r.valorMin ?? "--"} - ${r.valorMax ?? "--"}</td>
            </tr>`;
        }).join("");
    abrirModal("modalHistorial");
}

function mostrarMedicos(paciente) {
    const lista = paciente.medicosAsignados ?? [];
    $("modalMedicosLista").innerHTML = lista.length === 0
        ? '<div class="texto-suave centrado">Este paciente no tiene médicos especialistas asignados.</div>'
        : lista.map((m) => `<div class="item-medico"><span>✦</span> ${escapeHtml(m.nombreMedico || "Médico asignado")}</div>`).join("");
    abrirModal("modalMedicosAsignados");
}

function cambiarPestana(panelId, boton) {
    document.querySelectorAll(".tab-content").forEach((p) => p.classList.toggle("active", p.id === panelId));
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === boton));
}

// ---------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
    if (!exigirSesion("Acceso denegado. Inicie sesión con credenciales de Administrador.")) return;

    activarMenuHamburguesa();
    $("btnCerrarSesion").addEventListener("click", cerrarSesion);
    $("buscadorGeneral").addEventListener("input", debounce(pintar, 120));

    document.querySelectorAll("[data-panel]").forEach((boton) =>
        boton.addEventListener("click", () => cambiarPestana(boton.dataset.panel, boton)));

    $("tbodyPacientes").addEventListener("click", (e) => {
        const bHist = e.target.closest("[data-historial]");
        const bMed = e.target.closest("[data-medicos]");
        if (bHist) mostrarHistorial(pacientes[Number(bHist.dataset.historial)]);
        if (bMed) mostrarMedicos(pacientes[Number(bMed.dataset.medicos)]);
    });

    document.querySelectorAll(".custom-modal").forEach((modal) => {
        modal.addEventListener("click", (e) => {
            if (e.target === modal || e.target.closest("[data-cerrar]")) modal.classList.remove("show");
        });
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") document.querySelectorAll(".custom-modal.show").forEach((m) => m.classList.remove("show"));
    });

    await Promise.all([cargarAdministrador(), cargarDashboard()]);
});
