// Departamento -> ciudad -> altitud, igual en registro y en edición de perfil.
import { api } from "./api.js";
import { escapeHtml } from "./utils.js";

const cacheProvincias = new Map();
let cacheDepartamentos = null;

export class SelectorUbicacion {
    constructor({ departamento, ciudad, altitud }) {
        this.selDepto = departamento;
        this.selCiudad = ciudad;
        this.inputAltitud = altitud;

        this.selDepto.addEventListener("change", () => this.cargarCiudades(this.selDepto.value));
        this.selCiudad.addEventListener("change", () => this.actualizarAltitud());
    }

    get idDepartamento() { return this.selDepto.value ? Number(this.selDepto.value) : 0; }
    get idCiudad() { return this.selCiudad.value ? Number(this.selCiudad.value) : 0; }
    get textoDepartamento() { return this.selDepto.selectedOptions[0]?.textContent ?? ""; }
    get textoCiudad() { return this.selCiudad.selectedOptions[0]?.textContent ?? ""; }

    async cargarDepartamentos() {
        if (!cacheDepartamentos) {
            const resp = await api("geografia/departamentos", { auth: false });
            cacheDepartamentos = resp.ok && Array.isArray(resp.datos) ? resp.datos : [];
        }
        this.selDepto.innerHTML = '<option value="" disabled selected>Seleccione departamento</option>' +
            cacheDepartamentos.map((d) => `<option value="${d.idDepartamento}">${escapeHtml(d.nombre)}</option>`).join("");
    }

    async cargarCiudades(idDepto, idCiudadSeleccionada = null) {
        this.selCiudad.innerHTML = '<option value="" disabled selected>Seleccione ciudad</option>';
        this.inputAltitud.value = "";
        if (!idDepto) return;

        if (!cacheProvincias.has(String(idDepto))) {
            const resp = await api(`geografia/provincias/${idDepto}`, { auth: false });
            if (!resp.ok) return;
            cacheProvincias.set(String(idDepto), resp.datos);
        }

        this.selCiudad.innerHTML = '<option value="" disabled selected>Seleccione ciudad</option>' +
            cacheProvincias.get(String(idDepto))
                .map((p) => `<option value="${p.idCiudad}" data-altitud="${p.altitud}">${escapeHtml(p.nombre)}</option>`)
                .join("");

        if (idCiudadSeleccionada) {
            this.selCiudad.value = String(idCiudadSeleccionada);
            this.actualizarAltitud();
        }
    }

    actualizarAltitud() {
        const opcion = this.selCiudad.selectedOptions[0];
        this.inputAltitud.value = opcion?.value ? (opcion.dataset.altitud ?? 0) : "";
    }

    /** Marca el departamento y la ciudad guardados en el perfil. */
    async seleccionar(idDepto, idCiudad) {
        if (!idDepto) return;
        this.selDepto.value = String(idDepto);
        await this.cargarCiudades(idDepto, idCiudad);
    }
}
