// Pantalla a la que llega el enlace del correo: ?correo=... (cifrado por la API).
import { $ } from "./utils.js";
import { api } from "./api.js";
import { aviso, ocultarAviso, activarOjosPassword, activarMedidorPassword } from "./ui.js";
import { validarPassword } from "./validacion.js";

const correoCifrado = new URLSearchParams(window.location.search).get("correo");

document.addEventListener("DOMContentLoaded", () => {
    activarOjosPassword();
    activarMedidorPassword($("password"), $("fuerzaBarra"), $("fuerzaTexto"));

    if (!correoCifrado) {
        aviso("aviso", "error", "El enlace de recuperación es inválido o está incompleto. Solicita uno nuevo.");
        $("btnGuardar").disabled = true;
    }

    $("resetForm").addEventListener("submit", async (evento) => {
        evento.preventDefault();
        ocultarAviso("aviso");

        const password = $("password").value;
        const problema = validarPassword(password, $("confirmPassword").value);
        if (problema) {
            $("password").setAttribute("aria-invalid", "true");
            aviso("aviso", "error", problema);
            return;
        }
        $("password").removeAttribute("aria-invalid");

        const boton = $("btnGuardar");
        boton.disabled = true;
        boton.textContent = "Guardando...";

        const ruta = `Email/restablecercontraseña/${encodeURIComponent(correoCifrado)}/${encodeURIComponent(password)}`;
        const resp = await api(ruta, { metodo: "POST", auth: false });

        if (resp.ok) {
            aviso("aviso", "exito", resp.datos?.mensaje || "Tu contraseña se cambió correctamente. Redirigiendo...");
            setTimeout(() => { window.location.href = "index.html"; }, 2500);
            return;
        }
        boton.disabled = false;
        boton.textContent = "Guardar cambios";
        aviso("aviso", "error", resp.mensaje || "No se pudo cambiar la contraseña.");
    });
});
