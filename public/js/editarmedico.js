// Editar perfil de médico: datos personales + varias especialidades + alta opcional como paciente.
import { $, getUserId, exigirSesion } from "./utils.js";
import { api, sesionInvalida } from "./api.js";
import { aviso, ocultarAviso, loader, activarOjosPassword, activarMedidorPassword } from "./ui.js";
import { llenarTiposSangre, SelectorEspecialidades } from "./catalogos.js";
import { crearUbicacion, rellenarPerfil, iniciarCamposComunes, leerPerfil, validarPerfil, marcarInvalido, cuerpoPerfil } from "./perfilForm.js";

const form = $("formRegistro");
const ubicacion = crearUbicacion();
const especialidades = new SelectorEspecialidades($("selectorEspecialidades"));
let quiereSerPaciente = false;

function mostrarEstadoPaciente(yaEsPaciente, tipoSangre) {
    const cont = $("contenedorAccionRol");
    if (yaEsPaciente) {
        cont.innerHTML = '<div class="insignia-ok">✓ Ya está registrado como paciente</div>';
        $("contenedorTipoSangre").hidden = true;
        return;
    }
    cont.innerHTML = '<button class="btn btn-info" type="button" id="btnNuevoRol">Nuevo rol de paciente</button>';
    $("btnNuevoRol").addEventListener("click", () => {
        quiereSerPaciente = !quiereSerPaciente;
        $("contenedorTipoSangre").hidden = !quiereSerPaciente;
        $("btnNuevoRol").textContent = quiereSerPaciente ? "Cancelar rol de paciente" : "Nuevo rol de paciente";
        if (quiereSerPaciente) $("Tipo_Sangre").focus();
    });
    if (tipoSangre) $("Tipo_Sangre").value = tipoSangre;
}

async function cargar() {
    loader.mostrar("Cargando tus datos...");
    const resp = await api(`Medico/MisDatos/${getUserId()}`);

    if (sesionInvalida(resp)) {
        loader.ocultar();
        aviso("aviso", "error", "Tu sesión expiró. Inicia sesión nuevamente.");
        return;
    }
    if (!resp.ok) {
        loader.ocultar();
        aviso("aviso", "error", resp.mensaje || "No se pudieron cargar tus datos.");
        return;
    }

    const datos = resp.datos;
    await rellenarPerfil(datos, ubicacion);

    const idsActuales = (datos.especialidades ?? []).map((e) => Number(e.idEspecialidad));
    const ok = await especialidades.cargar(idsActuales);
    loader.ocultar();
    if (!ok) aviso("aviso", "error", "No se pudieron cargar las especialidades. Recarga la página antes de guardar.");

    mostrarEstadoPaciente(Boolean(datos.veripaciente), datos.tipoSangre);
}

async function guardar(evento) {
    evento.preventDefault();
    ocultarAviso("aviso");

    const datos = leerPerfil(ubicacion);
    let problema = validarPerfil(datos, ubicacion);
    if (!problema && especialidades.ids().length === 0) {
        problema = { campo: "selectorEspecialidades", mensaje: "Elige al menos una especialidad." };
    }
    if (!problema && quiereSerPaciente && !$("Tipo_Sangre").value) {
        problema = { campo: "Tipo_Sangre", mensaje: "Selecciona tu tipo de sangre para registrarte como paciente." };
    }
    if (problema) {
        marcarInvalido(problema.campo);
        aviso("aviso", "error", problema.mensaje);
        return;
    }

    const ids = especialidades.ids();
    const cuerpo = {
        ...cuerpoPerfil(datos, getUserId()),
        Rol: quiereSerPaciente ? "Paciente" : "Medico",
        Tipo_Sangre: quiereSerPaciente ? $("Tipo_Sangre").value : null,
        IdEspecialidad: ids[0],
        IdEspecialidades: ids
    };

    const boton = $("btnGuardar");
    boton.disabled = true;
    loader.mostrar("Guardando cambios...");
    const resp = await api(`Medico/editarmedico/${getUserId()}`, { metodo: "PUT", cuerpo });
    loader.ocultar();
    boton.disabled = false;

    if (resp.ok) {
        aviso("aviso", "exito", resp.datos?.mensaje || "Perfil actualizado correctamente.");
        $("password").value = "";
        $("confirm_password").value = "";
        setTimeout(() => { window.location.href = "Pagina_Medicos.html"; }, 1200);
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
