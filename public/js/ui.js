// Piezas de interfaz reutilizables.
import { $, escapeHtml } from "./utils.js";

/** Pantalla de carga global (la define loader.js, que es un script clásico). */
export const loader = {
    mostrar: (mensaje) => globalThis.mostrarLoader?.(mensaje),
    ocultar: () => globalThis.ocultarLoader?.()
};

/**
 * Muestra un aviso dentro de la página (en lugar de alert()).
 * @param {"error"|"exito"|"info"} tipo
 */
export function aviso(contenedor, tipo, texto) {
    const el = typeof contenedor === "string" ? $(contenedor) : contenedor;
    if (!el) return;
    el.className = `aviso aviso-${tipo}`;
    el.innerHTML = escapeHtml(texto).replace(/\n/g, "<br>");
    el.hidden = false;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

export function ocultarAviso(contenedor) {
    const el = typeof contenedor === "string" ? $(contenedor) : contenedor;
    if (el) el.hidden = true;
}

const OJO = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
const OJO_TACHADO = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';

/**
 * Activa los botones <button data-toggle-password="idDelInput"> que muestran u ocultan la contraseña.
 * Dentro del botón debe haber un <svg>.
 */
export function activarOjosPassword(raiz = document) {
    raiz.querySelectorAll("[data-toggle-password]").forEach((boton) => {
        boton.addEventListener("click", () => {
            const input = $(boton.dataset.togglePassword);
            const icono = boton.querySelector("svg");
            if (!input) return;
            const mostrar = input.type === "password";
            input.type = mostrar ? "text" : "password";
            if (icono) icono.innerHTML = mostrar ? OJO_TACHADO : OJO;
            boton.setAttribute("aria-label", mostrar ? "Ocultar contraseña" : "Mostrar contraseña");
        });
    });
}

/** Medidor de fuerza de contraseña (0 a 4) enlazado a un input y una barra. */
export function activarMedidorPassword(input, barra, etiqueta) {
    if (!input || !barra) return;
    const textos = ["Muy débil", "Débil", "Aceptable", "Buena", "Excelente"];

    input.addEventListener("input", () => {
        const v = input.value;
        let puntos = 0;
        if (v.length >= 8) puntos++;
        if (/[a-z]/.test(v) && /[A-Z]/.test(v)) puntos++;
        if (/\d/.test(v)) puntos++;
        if (/[\W_]/.test(v)) puntos++;
        if (!v) puntos = -1;

        barra.dataset.nivel = String(Math.max(puntos, 0));
        barra.style.setProperty("--nivel", String(Math.max(puntos, 0)));
        if (etiqueta) etiqueta.textContent = v ? textos[puntos] : "";
    });
}

/** Menú hamburguesa de las barras superiores (si la página lo tiene). */
export function activarMenuHamburguesa() {
    const toggle = $("navToggle");
    const links = $("navLinks");
    if (!toggle || !links) return;

    const cerrar = () => {
        links.classList.remove("active");
        toggle.classList.remove("open");
    };

    toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        links.classList.toggle("active");
        toggle.classList.toggle("open");
    });
    links.querySelectorAll("button, a").forEach((el) => el.addEventListener("click", cerrar));
    document.addEventListener("click", (e) => {
        if (!toggle.contains(e.target) && !links.contains(e.target)) cerrar();
    });
    document.addEventListener("keydown", (e) => e.key === "Escape" && cerrar());
}
