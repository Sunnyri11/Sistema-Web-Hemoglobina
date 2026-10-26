// Acceso a la API. Usa API_URL de config.js (script clásico cargado antes).
import { getToken } from "./utils.js";

/**
 * Llama a la API sin lanzar excepciones por errores HTTP o de red.
 * @returns {Promise<{ok:boolean, status:number, datos:any, mensaje:string}>}
 */
export async function api(ruta, { metodo = "GET", cuerpo, auth = true } = {}) {
    const headers = {};
    if (cuerpo !== undefined) headers["Content-Type"] = "application/json";
    if (auth) headers["Authorization"] = `Bearer ${getToken()}`;

    try {
        const respuesta = await fetch(`${globalThis.API_URL}${ruta}`, {
            method: metodo,
            headers,
            body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
        });

        const texto = await respuesta.text();
        let datos = null;
        try { datos = texto ? JSON.parse(texto) : null; } catch { datos = texto || null; }

        return {
            ok: respuesta.ok,
            status: respuesta.status,
            datos,
            mensaje: respuesta.ok ? "" : mensajeDeError(datos, respuesta.status)
        };
    } catch (error) {
        console.error("Error de red:", error);
        return { ok: false, status: 0, datos: null, mensaje: "No se pudo conectar con el servidor." };
    }
}

/** Extrae un texto legible de las distintas formas de error que devuelve la API. */
export function mensajeDeError(datos, status = 0) {
    if (typeof datos === "string" && datos.trim()) return datos;
    if (datos?.errors) {
        return Object.entries(datos.errors)
            .map(([campo, msgs]) => `• ${campo}: ${[].concat(msgs).join(", ")}`)
            .join("\n");
    }
    return datos?.mensaje || datos?.error || datos?.title || `Error ${status || ""}`.trim();
}

/** true si el token venció o no tiene permisos. */
export const sesionInvalida = (resp) => resp.status === 401 || resp.status === 403;
