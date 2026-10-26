// Editar perfil de paciente: carga los datos actuales y guarda los cambios.
import { $, getUserId, exigirSesion } from "./utils.js";
import { api, sesionInvalida } from "./api.js";
import { aviso, ocultarAviso, loader, activarOjosPassword, activarMedidorPassword } from "./ui.js";
import { llenarTiposSangre } from "./catalogos.js";
import { crearUbicacion, rellenarPerfil, iniciarCamposComunes, leerPerfil, validarPerfil, marcarInvalido, cuerpoPerfil } from "./perfilForm.js";

const form = $("formRegistro");
const ubicacion = crearUbicacion();

async function cargar() {
    const id = getUserId();
    loader.mostrar("Cargando tus datos...");
    const resp = await api(`Paciente/MisDatos/${id}`);
    loader.ocultar();

    if (sesionInvalida(resp)) {
        aviso("aviso", "error", "Tu sesión expiró. Inicia sesión nuevamente.");
        return;
    }
    if (!resp.ok) {
        aviso("aviso", "error", resp.mensaje || "No se pudieron cargar tus datos.");
        return;
    }

    await rellenarPerfil(resp.datos, ubicacion);
    const sangre = resp.datos.tipoSangre?.tipoDeSangre;
    if (sangre) $("Tipo_Sangre").value = sangre;
}

async function guardar(evento) {
    evento.preventDefault();
    ocultarAviso("aviso");

    const datos = leerPerfil(ubicacion);
    const problema = validarPerfil(datos, ubicacion);
    if (problema) {
        marcarInvalido(problema.campo);
        aviso("aviso", "error", problema.mensaje);
        return;
    }

    const cuerpo = { ...cuerpoPerfil(datos, getUserId()), Rol: "Paciente", Tipo_Sangre: $("Tipo_Sangre").value || null };

    const boton = $("btnGuardar");
    boton.disabled = true;
    loader.mostrar("Guardando cambios...");
    const resp = await api(`Paciente/editarpaciente/${getUserId()}`, { metodo: "PUT", cuerpo });
    loader.ocultar();
    boton.disabled = false;

    if (resp.ok) {
        aviso("aviso", "exito", resp.datos?.mensaje || "Perfil actualizado correctamente.");
        $("password").value = "";
        $("confirm_password").value = "";
        setTimeout(() => { window.location.href = "Monitoreo.html"; }, 1200);
        return;
    }
    aviso("aviso", "error", sesionInvalida(resp) ? "Tu sesión expiró. Inicia sesión nuevamente." : (resp.mensaje || "No se pudo guardar."));
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!exigirSesion("Acceso no autorizado. Inicia sesión nuevamente.")) return;
    iniciarCamposComunes();
    llenarTiposSangre($("Tipo_Sangre"));
    activarOjosPassword();
    activarMedidorPassword($("password"), $("fuerzaBarra"), $("fuerzaTexto"));
    form.addEventListener("submit", guardar);
    form.addEventListener("input", (e) => e.target.removeAttribute?.("aria-invalid"));

    await ubicacion.cargarDepartamentos();
    await cargar();
});
