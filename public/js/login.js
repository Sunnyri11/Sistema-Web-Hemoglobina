// Inicio de sesión.
import { $ } from "./utils.js";
import { api } from "./api.js";
import { aviso, ocultarAviso, loader } from "./ui.js";

const DESTINOS = {
    Paciente: "view/Monitoreo.html",
    Medico: "view/Pagina_Medicos.html",
    Administrador: "view/Pagina_Administrador.html"
};

// Si ya hay una sesión guardada no hace falta volver a escribir las credenciales
// (el panel valida el token y, si venció, regresa aquí).
async function iniciarSesion(evento) {
    evento.preventDefault();
    ocultarAviso("aviso");

    const correo = $("correo").value.trim();
    const password = $("password").value;
    const rol = $("rol").value;

    if (!rol) {
        aviso("aviso", "error", "Selecciona tu rol en el sistema.");
        $("rol").focus();
        return;
    }

    const boton = $("btnLogin");
    boton.disabled = true;
    loader.mostrar("Validando credenciales...");

    const resp = await api("Autenticacion/login", { metodo: "POST", auth: false, cuerpo: { email: correo, password, rol } });

    if (!resp.ok) {
        loader.ocultar();
        boton.disabled = false;
        aviso("aviso", "error", resp.mensaje || "Correo, contraseña o rol incorrectos.");
        return;
    }

    const datos = resp.datos;
    const destino = DESTINOS[datos.rol];
    if (!datos.token || !destino) {
        loader.ocultar();
        boton.disabled = false;
        aviso("aviso", "error", "La respuesta del servidor no es válida. Intenta de nuevo.");
        return;
    }

    localStorage.setItem("token_seguridad", datos.token);
    localStorage.setItem("usuario_id", datos.idEntidad);
    loader.mostrar(`¡Bienvenido ${datos.nombre || ""}!`);
    setTimeout(() => { loader.ocultar(); window.location.href = destino; }, 700);
}

document.addEventListener("DOMContentLoaded", () => {
    $("formSistema").addEventListener("submit", iniciarSesion);
});
