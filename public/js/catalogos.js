// Catálogos y listas que se repetían en varios formularios.
import { api } from "./api.js";
import { escapeHtml } from "./utils.js";

const TIPOS_SANGRE = [
    ["Grupo O", [["O+", "O Positivo (O+)"], ["O-", "O Negativo (O-)"]]],
    ["Grupo A", [["A+", "A Positivo (A+)"], ["A-", "A Negativo (A-)"]]],
    ["Grupo B", [["B+", "B Positivo (B+)"], ["B-", "B Negativo (B-)"]]],
    ["Grupo AB", [["AB+", "AB Positivo (AB+)"], ["AB-", "AB Negativo (AB-)"]]]
];

export function llenarTiposSangre(select, placeholder = "Seleccione su tipo de sangre") {
    if (!select) return;
    const grupos = TIPOS_SANGRE.map(([grupo, opciones]) =>
        `<optgroup label="${grupo}">${opciones.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</optgroup>`
    ).join("");
    select.innerHTML = `<option value="" disabled selected>${placeholder}</option>${grupos}<option value="Desconocido">No sabe</option>`;
}

let cacheEspecialidades = null;

/** Lista de especialidades [{idEspecialidad, nombre}] (se pide una sola vez). */
export async function obtenerEspecialidades() {
    if (cacheEspecialidades) return cacheEspecialidades;
    const resp = await api("Especialidades", { auth: false });
    cacheEspecialidades = resp.ok && Array.isArray(resp.datos) ? resp.datos : [];
    return cacheEspecialidades;
}

/**
 * Selector de varias especialidades: muestra las elegidas como "chips" que se pueden quitar
 * y un desplegable con las que faltan. Nunca guarda repetidas.
 */
export class SelectorEspecialidades {
    /** @param {HTMLElement} contenedor */
    constructor(contenedor) {
        this.contenedor = contenedor;
        this.catalogo = [];
        this.seleccion = new Set();
        this.contenedor.classList.add("multi-especialidades");
        this.contenedor.innerHTML = `
            <div class="chips" role="list" aria-live="polite"></div>
            <select class="agregar" aria-label="Agregar especialidad"></select>`;
        this.chips = this.contenedor.querySelector(".chips");
        this.select = this.contenedor.querySelector(".agregar");

        this.select.addEventListener("change", () => {
            if (this.select.value) this.agregar(Number(this.select.value));
        });
        this.chips.addEventListener("click", (e) => {
            const boton = e.target.closest("[data-quitar]");
            if (boton) this.quitar(Number(boton.dataset.quitar));
        });
    }

    async cargar(idsIniciales = []) {
        this.select.innerHTML = '<option value="" disabled selected>Cargando especialidades...</option>';
        this.catalogo = await obtenerEspecialidades();
        this.seleccion = new Set(idsIniciales.map(Number).filter((id) => this.catalogo.some((e) => e.idEspecialidad === id)));
        this.pintar();
        return this.catalogo.length > 0;
    }

    agregar(id) { this.seleccion.add(id); this.pintar(); }
    quitar(id) { this.seleccion.delete(id); this.pintar(); }
    ids() { return [...this.seleccion]; }

    pintar() {
        const nombre = (id) => this.catalogo.find((e) => e.idEspecialidad === id)?.nombre ?? `#${id}`;
        this.chips.innerHTML = this.seleccion.size
            ? this.ids().map((id) => `
                <span class="chip" role="listitem">${escapeHtml(nombre(id))}
                    <button type="button" data-quitar="${id}" aria-label="Quitar ${escapeHtml(nombre(id))}">&times;</button>
                </span>`).join("")
            : '<span class="chips-vacio">Aún no elegiste ninguna especialidad.</span>';

        const faltantes = this.catalogo.filter((e) => !this.seleccion.has(e.idEspecialidad));
        this.select.innerHTML = faltantes.length
            ? `<option value="" disabled selected>+ Agregar especialidad</option>${faltantes
                .map((e) => `<option value="${e.idEspecialidad}">${escapeHtml(e.nombre)}</option>`).join("")}`
            : '<option value="" disabled selected>Ya agregaste todas</option>';
        this.select.disabled = faltantes.length === 0;
    }
}
