// Panel del médico: sus pacientes, gráfico de estados y alta/baja de pacientes.
import { $, escapeHtml, getFullName, getUserId, cerrarSesion, exigirSesion, formatearFecha, parseFecha, normalizar, debounce } from "./utils.js";
import { api, sesionInvalida } from "./api.js";
import { activarMenuHamburguesa } from "./ui.js";

let misPacientes = [];       // pacientes asignados (para filtrar sin volver a pedir a la API)
let pacientesGlobales = [];  // pacientes que se pueden añadir
let medico = {};
let pestanaActual = "mis";

const ESTADOS = {
    Normal: { badge: "badge-normal", color: "var(--color-normal)" },
    Anemia: { badge: "badge-anemia", color: "var(--color-anemia)" },
    Poliglobulia: { badge: "badge-poliglobulia", color: "var(--color-poliglobulia)" }
};

const filaMensaje = (columnas, texto, error = false) =>
    `<tr class="fila-mensaje"><td colspan="${columnas}" class="${error ? "texto-error" : ""}">${escapeHtml(texto)}</td></tr>`;

const ciudadDe = (p) => [p.departamento?.departamento1, p.ciudad?.nombre].filter(Boolean).join(" / ") || "Sin datos";

/** Último análisis (por fecha) y el estado clínico que le corresponde. */
function evaluar(paciente) {
    const historial = paciente.historialHemoglobinas ?? [];
    if (historial.length === 0) return { estado: "Normal", hb: "Sin registros", fecha: "Sin registros", sinDatos: true };

    const ultimo = [...historial].sort((a, b) => (parseFecha(a.fecha) ?? 0) - (parseFecha(b.fecha) ?? 0)).at(-1);
    const { valor, rango } = ultimo;
    let estado = "Normal";
    if (rango && valor < rango.minimo) estado = "Anemia";
    else if (rango && valor > rango.maximo) estado = "Poliglobulia";

    return { estado, hb: `${valor} g/dL`, fecha: formatearFecha(ultimo.fecha), sinDatos: false };
}

// ---------------------------------------------------------------------------
// Datos del médico
// ---------------------------------------------------------------------------
async function cargarMedico() {
    const resp = await api(`Medico/MisDatos/${getUserId()}`);
    if (sesionInvalida(resp)) return cerrarSesion();
    if (!resp.ok) {
        console.error("No se pudieron cargar los datos del médico:", resp.mensaje);
        $("txtMedico").textContent = "Panel médico";
        return;
    }
    medico = resp.datos;
    console.log(medico);
    const persona = medico.persona ?? medico.Persona;
    $("txtMedico").textContent = persona ? `Dr(a). ${getFullName(persona)}` : "Panel médico";
}

// ---------------------------------------------------------------------------
// Mis pacientes
// ---------------------------------------------------------------------------
async function cargarMisPacientes() {
    const cuerpo = $("listaPacientes");
    cuerpo.innerHTML = filaMensaje(7, "Cargando pacientes...");

    const resp = await api(`Medico/mis-pacientes/${getUserId()}`);
    if (sesionInvalida(resp)) {
        alert("Sesión no válida, expirada o sin permisos suficientes.");
        return cerrarSesion();
    }
    if (!resp.ok) {
        misPacientes = [];
        cuerpo.innerHTML = filaMensaje(7, resp.status === 0 ? "Fallo de conexión con el servidor." : "No se pudieron cargar los pacientes.", true);
        pintarGrafico({ Normal: 0, Anemia: 0, Poliglobulia: 0 });
        $("lblTotalPacientes").textContent = "0";
        return;
    }

    misPacientes = Array.isArray(resp.datos) ? resp.datos : [];
    $("lblTotalPacientes").textContent = String(misPacientes.length);
    pintarMisPacientes();
}

function pintarMisPacientes() {
    const cuerpo = $("listaPacientes");
    const texto = normalizar($("txtBuscarPaciente").value);
    const conteo = { Normal: 0, Anemia: 0, Poliglobulia: 0 };

    // El gráfico siempre refleja a todos los pacientes, aunque se filtre la tabla.
    const evaluados = misPacientes.map((p) => ({ p, ...evaluar(p) }));
    evaluados.forEach((e) => { conteo[e.estado]++; });
    pintarGrafico(conteo);

    if (misPacientes.length === 0) {
        cuerpo.innerHTML = filaMensaje(7, "No tiene pacientes asignados.");
        return;
    }

    const visibles = evaluados.filter((e) => normalizar(getFullName(e.p)).includes(texto));
    if (visibles.length === 0) {
        cuerpo.innerHTML = filaMensaje(7, "No se encontraron coincidencias.");
        return;
    }

    cuerpo.innerHTML = visibles.map(({ p, estado, hb, fecha }) => {
        const nombre = getFullName(p);
        const id = Number(p.idUsuario ?? p.idPersona);
        return `
        <tr title="Doble clic para desvincular al paciente" data-id="${id}">
            <td data-label="Paciente">
                <div class="patient-cell">
                    <div class="avatar" style="background-color:${ESTADOS[estado].color}">${escapeHtml(nombre.charAt(0).toUpperCase())}</div>
                    <span>${escapeHtml(nombre)}</span>
                </div>
            </td>
            <td data-label="Último análisis" class="hb-value">${escapeHtml(hb)}</td>
            <td data-label="Fecha" class="hb-value">${escapeHtml(fecha)}</td>
            <td data-label="Tipo de sangre" class="hb-value">${escapeHtml(p.tipoSangre || "Sin registro")}</td>
            <td data-label="Ciudad" class="hb-value">${escapeHtml(ciudadDe(p))}</td>
            <td data-label="Análisis"><span class="badge ${ESTADOS[estado].badge}">${estado}</span></td>
            <td data-label="Acción">
                <button class="btn btn-danger btn-sm text-white" data-quitar="${id}">❌ Quitar</button>
            </td>
        </tr>`;
    }).join("");
}

function pintarGrafico(conteo) {
    const donut = $("graficoDonut");
    const total = conteo.Normal + conteo.Anemia + conteo.Poliglobulia;

    $("mensajeSinPacientes").hidden = total > 0;
    donut.hidden = total === 0;
    donut.innerHTML = "";
    if (total === 0) return;

    const pNormal = (conteo.Normal / total) * 100;
    const pAnemia = (conteo.Anemia / total) * 100;
    const finNormal = pNormal;
    const finAnemia = pNormal + pAnemia;

    donut.style.background = `conic-gradient(
        var(--color-normal) 0% ${finNormal}%,
        var(--color-anemia) ${finNormal}% ${finAnemia}%,
        var(--color-poliglobulia) ${finAnemia}% 100%)`;
    donut.title = `Distribución actual:\n• Normales: ${conteo.Normal}\n• Anemia: ${conteo.Anemia}\n• Poliglobulia: ${conteo.Poliglobulia}`;

    // Las etiquetas se colocan en porcentaje del contenedor, así siguen alineadas si el gráfico cambia de tamaño.
    const rebanadas = [
        [conteo.Normal, 0, finNormal],
        [conteo.Anemia, finNormal, finAnemia],
        [conteo.Poliglobulia, finAnemia, 100]
    ];
    for (const [cantidad, desde, hasta] of rebanadas) {
        if (!cantidad) continue;
        const angulo = ((desde + hasta) / 2) * 3.6 - 90;
        const rad = (angulo * Math.PI) / 180;
        const etiqueta = document.createElement("span");
        etiqueta.className = "porcentaje-pastel";
        etiqueta.textContent = `${Math.round((cantidad / total) * 100)}%`;
        etiqueta.style.left = `${50 + 31 * Math.cos(rad)}%`;
        etiqueta.style.top = `${50 + 31 * Math.sin(rad)}%`;
        donut.appendChild(etiqueta);
    }
}

// ---------------------------------------------------------------------------
// Añadir pacientes
// ---------------------------------------------------------------------------
async function cargarPacientesGlobales() {
    const cuerpo = $("listaPacientesGlobales");
    cuerpo.innerHTML = filaMensaje(4, "Cargando pacientes...");

    const resp = await api(`Medico/pacientes/${getUserId()}`);
    if (sesionInvalida(resp)) return cerrarSesion();
    if (!resp.ok) {
        pacientesGlobales = [];
        cuerpo.innerHTML = filaMensaje(4, "Error al cargar los pacientes desde el servidor.", true);
        return;
    }

    // Un médico que también es paciente no debe poder añadirse a sí mismo.
    const idPersonaMedico = Number((medico.persona ?? medico.Persona)?.idPersona);
    const yaAsignados = new Set(misPacientes.map((p) => Number(p.idUsuario ?? p.idPersona)));
    pacientesGlobales = (Array.isArray(resp.datos) ? resp.datos : [])
        .filter((p) => Number(p.idUsuario) !== idPersonaMedico);
    pacientesGlobales.forEach((p) => { p._asignado = yaAsignados.has(Number(p.idPaciente ?? p.IdPaciente ?? p.idUsuario)); });
    pintarPacientesGlobales();
}

function pintarPacientesGlobales() {
    const cuerpo = $("listaPacientesGlobales");
    const texto = normalizar($("txtBuscarPaciente").value);

    if (pacientesGlobales.length === 0) {
        cuerpo.innerHTML = filaMensaje(4, "No hay pacientes disponibles para añadir.");
        return;
    }
    const visibles = pacientesGlobales.filter((p) => normalizar(getFullName(p)).includes(texto));
    if (visibles.length === 0) {
        cuerpo.innerHTML = filaMensaje(4, "No se encontraron coincidencias.");
        return;
    }

    cuerpo.innerHTML = visibles.map((p) => {
        const id = Number(p.idPaciente ?? p.IdPaciente);
        return `
        <tr>
            <td data-label="Paciente"><strong>${escapeHtml(getFullName(p))}</strong></td>
            <td data-label="Tipo de sangre"><span class="badge bg-light text-dark border">${escapeHtml(p.tipoSangre || p.TipoSangre || "No registrado")}</span></td>
            <td data-label="Ciudad"><span class="badge bg-light text-dark border">${escapeHtml(ciudadDe(p))}</span></td>
            <td data-label="Acción"><button class="btn btn-info btn-sm text-white" data-anadir="${id}">➕ Añadir</button></td>
        </tr>`;
    }).join("");
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------
async function quitarPaciente(id) {
    const resp = await api(`Medico/borrar-paciente/${id}`, { metodo: "DELETE" });
    alert(resp.datos?.mensaje || (resp.ok ? "El paciente fue removido con éxito." : resp.mensaje || "No se pudo eliminar la relación médica."));
    if (resp.ok) await cargarMisPacientes();
}

async function anadirPaciente(id) {
    if (!id) return;
    const resp = await api(`Medico/añadir-paciente/${id}`, { metodo: "POST" });
    alert(resp.datos?.mensaje || (resp.ok ? "Paciente añadido correctamente a tu lista de seguimiento." : resp.mensaje || "No se pudo asociar el paciente."));
    if (resp.ok) {
        await cargarMisPacientes();
        await cargarPacientesGlobales();
    }
}

async function cambiarPestana(nombre) {
    pestanaActual = nombre;
    const mis = nombre === "mis";
    $("vistaMisPacientes").hidden = !mis;
    $("vistaAnadirPacientes").hidden = mis;
    $("tabMisPacientes").classList.toggle("active", mis);
    $("tabAnadirPacientes").classList.toggle("active", !mis);
    $("tabMisPacientes").setAttribute("aria-selected", String(mis));
    $("tabAnadirPacientes").setAttribute("aria-selected", String(!mis));

    if (mis) await cargarMisPacientes();
    else await cargarPacientesGlobales();
}

// ---------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
    if (!exigirSesion("Acceso no autorizado. Inicie sesión nuevamente.")) return;

    activarMenuHamburguesa();
    $("btnCerrarSesion").addEventListener("click", cerrarSesion);
    $("btnEditarPerfil").addEventListener("click", () => { window.location.href = "EditarMedico.html"; });
    $("tabMisPacientes").addEventListener("click", () => cambiarPestana("mis"));
    $("tabAnadirPacientes").addEventListener("click", () => cambiarPestana("anadir"));

    $("txtBuscarPaciente").addEventListener("input", debounce(() => {
        if (pestanaActual === "mis") pintarMisPacientes();
        else pintarPacientesGlobales();
    }, 120));

    // Delegación de eventos: sin onclick dentro del HTML generado.
    $("listaPacientes").addEventListener("click", (e) => {
        const boton = e.target.closest("[data-quitar]");
        if (boton) quitarPaciente(Number(boton.dataset.quitar));
    });
    $("listaPacientes").addEventListener("dblclick", (e) => {
        const fila = e.target.closest("tr[data-id]");
        if (fila && !e.target.closest("button") && confirm("¿Deseas desvincular por completo al paciente de tu cuenta?")) {
            quitarPaciente(Number(fila.dataset.id));
        }
    });
    $("listaPacientesGlobales").addEventListener("click", (e) => {
        const boton = e.target.closest("[data-anadir]");
        if (boton) anadirPaciente(Number(boton.dataset.anadir));
    });

    await cargarMedico();
    await cargarMisPacientes();
});
