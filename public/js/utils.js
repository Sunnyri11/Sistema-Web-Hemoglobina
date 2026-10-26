// Utilidades compartidas por todas las páginas (módulo ES).

export const $ = (id) => document.getElementById(id);

export const getToken = () => (localStorage.getItem("token_seguridad") || "").trim();
export const getUserId = () => localStorage.getItem("usuario_id");

/** Evita que un texto de la base de datos inyecte HTML al usar innerHTML. */
export function escapeHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

/** Lee un campo aunque el backend lo mande en camelCase o PascalCase. */
export function campo(obj, nombre) {
    if (!obj) return undefined;
    return obj[nombre] ?? obj[nombre.charAt(0).toUpperCase() + nombre.slice(1)];
}

export function getFullName(persona) {
    const nombre = `${persona?.nombre || ""} ${persona?.paterno || ""} ${persona?.materno || ""}`.trim();
    return nombre || "Paciente sin nombre";
}

export function cerrarSesion() {
    localStorage.removeItem("token_seguridad");
    localStorage.removeItem("usuario_id");
    window.location.href = "../index.html";
}

/**
 * Comprueba que haya sesión. Si no la hay, avisa y manda al inicio.
 * @returns {string|null} el token, o null si se redirigió.
 */
export function exigirSesion(mensaje = "Inicia sesión para continuar.") {
    const token = getToken();
    if (!token || !getUserId()) {
        alert(mensaje);
        window.location.href = "../index.html";
        return null;
    }
    return token;
}

/** "2026-10-25" o "2026-10-25T00:00:00" -> Date en hora local (sin desfase de zona horaria). */
export function parseFecha(valor) {
    if (!valor) return null;
    if (valor instanceof Date) return valor;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor));
    const fecha = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Date -> "25/10/2026" ("S/D" si no es válida). */
export function formatearFecha(valor) {
    const f = parseFecha(valor);
    return f ? `${f.getDate()}/${f.getMonth() + 1}/${f.getFullYear()}` : "S/D";
}

/** Fecha de hoy como "AAAA-MM-DD" en hora local (para el atributo max de un input date). */
export function hoyISO() {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
}

export function debounce(fn, ms = 200) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

export const normalizar = (texto) =>
    String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
