// "¿Olvidaste tu contraseña?": pide el correo y la API envía el enlace de recuperación.
import { $ } from "./utils.js";
import { api } from "./api.js";
import { aviso, ocultarAviso } from "./ui.js";
import { validarCorreo } from "./validacion.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = $("forgotPasswordForm");

    form.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        ocultarAviso("aviso");

        const correo = $("correo").value.trim();
        const error = validarCorreo(correo);
        if (error) {
            $("correo").setAttribute("aria-invalid", "true");
            aviso("aviso", "error", error);
            return;
        }
        $("correo").removeAttribute("aria-invalid");

        const boton = $("btnEnviar");
        boton.disabled = true;
        boton.textContent = "Enviando...";

        const resp = await api(`Email/olvidocontraseña/${encodeURIComponent(correo)}`, { metodo: "POST", auth: false });

        boton.disabled = false;
        boton.textContent = "Restablecer contraseña";

        if (resp.ok) {
            aviso("aviso", "exito", "Si el correo existe, te enviamos las instrucciones. Revisa también la carpeta de spam.");
            form.reset();
        } else if (resp.status === 400 || resp.status === 404) {
            aviso("aviso", "error", "No encontramos una cuenta con ese correo.");
        } else {
            aviso("aviso", "error", resp.status === 0 ? resp.mensaje : "Ocurrió un error en el servidor. Inténtalo de nuevo.");
        }
    });
});
