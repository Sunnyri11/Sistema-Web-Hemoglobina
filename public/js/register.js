import { $, hoyISO } from "./utils.js";
import { api } from "./api.js";
import { aviso, ocultarAviso, loader, activarOjosPassword, activarMedidorPassword } from "./ui.js";
import { llenarTiposSangre, SelectorEspecialidades } from "./catalogos.js";
import { SelectorUbicacion } from "./geografia.js";
import { validarNombre, validarCorreo, validarFechaNacimiento, validarPassword } from "./validacion.js";

const form = $("formRegistro");
const ubicacion = new SelectorUbicacion({
    departamento: $("departamento"),
    ciudad: $("provincia"),
    altitud: $("altitud")
});
const especialidades = new SelectorEspecialidades($("selectorEspecialidades"));
let especialidadesCargadas = false;

const rolElegido = () => form.querySelector('input[name="rol"]:checked')?.value ?? "";

// ---------------------------------------------------------------------------
// Rol: muestra tipo de sangre (paciente) o especialidades (médico)
// ---------------------------------------------------------------------------
async function alCambiarRol() {
    const rol = rolElegido();
    $("contenedorTipoSangre").hidden = rol !== "Paciente";
    $("contenedorEspecialidad").hidden = rol !== "Medico";

    if (rol === "Medico" && !especialidadesCargadas) {
        especialidadesCargadas = await especialidades.cargar();
        if (!especialidadesCargadas) aviso("aviso", "error", "No se pudieron cargar las especialidades. Recarga la página.");
    }
}

// ---------------------------------------------------------------------------
// Validación: devuelve { campo, mensaje } del primer problema, o null
// ---------------------------------------------------------------------------
function leerFormulario() {
    return {
        nombre: $("nombre").value.trim(),
        paterno: $("apellido_paterno").value.trim(),
        materno: $("apellido_materno").value.trim(),
        genero: form.querySelector('input[name="genero"]:checked')?.value ?? "",
        fecha: $("fecha_nacimiento").value,
        altitud: parseFloat($("altitud").value),
        correo: $("correo").value.trim(),
        password: $("password").value,
        confirmacion: $("confirm_password").value,
        rol: rolElegido(),
        tipoSangre: $("Tipo_Sangre").value
    };
}

function validar(d) {
    const comprobaciones = [
        ["nombre", validarNombre(d.nombre, "El nombre", { obligatorio: true })],
        ["apellido_paterno", validarNombre(d.paterno, "El apellido paterno", { obligatorio: true })],
        ["apellido_materno", validarNombre(d.materno, "El apellido materno")],
        ["fecha_nacimiento", validarFechaNacimiento(d.fecha)],
        ["departamento", ubicacion.idDepartamento ? "" : "Selecciona un departamento."],
        ["provincia", ubicacion.idCiudad ? "" : "Selecciona una ciudad."],
        ["altitud", Number.isNaN(d.altitud) || d.altitud < 0 ? "La altitud debe ser un número mayor o igual a 0." : ""],
        ["correo", validarCorreo(d.correo)],
        ["password", validarPassword(d.password, d.confirmacion)],
        ["rol", d.rol ? "" : "Elige cómo usarás el sistema (paciente o médico)."],
        ["Tipo_Sangre", d.rol === "Paciente" && !d.tipoSangre ? "Selecciona tu tipo de sangre." : ""],
        ["selectorEspecialidades", d.rol === "Medico" && especialidades.ids().length === 0 ? "Elige al menos una especialidad." : ""]
    ];
    const falla = comprobaciones.find(([, mensaje]) => mensaje);
    return falla ? { campo: falla[0], mensaje: falla[1] } : null;
}

function marcarInvalido(idCampo) {
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    const el = $(idCampo);
    if (!el) return;
    if (el.matches("input, select")) el.setAttribute("aria-invalid", "true");
    (el.matches("input, select") ? el : el.querySelector("select"))?.focus({ preventScroll: false });
}

// ---------------------------------------------------------------------------
// Envío
// ---------------------------------------------------------------------------
async function enviar(evento) {
    evento.preventDefault();
    ocultarAviso("aviso");

    const datos = leerFormulario();
    const problema = validar(datos);
    if (problema) {
        marcarInvalido(problema.campo);
        aviso("aviso", "error", problema.mensaje);
        return;
    }

    const ids = especialidades.ids();
    const cuerpo = {
        nombre: datos.nombre,
        apellidoPaterno: datos.paterno,
        apellidoMaterno: datos.materno,
        genero: datos.genero,
        fechaNacimiento: datos.fecha,
        departamento: ubicacion.textoDepartamento,
        idDepartamento: ubicacion.idDepartamento,
        idCiudad: ubicacion.idCiudad,
        provincia: ubicacion.textoCiudad,
        altitud: datos.altitud,
        correo: datos.correo,
        password: datos.password,
        rol: datos.rol,
        tipo_sangre: datos.rol === "Paciente" ? datos.tipoSangre : null,
        idEspecialidad: datos.rol === "Medico" ? ids[0] : 0,
        idEspecialidades: datos.rol === "Medico" ? ids : []
    };

    const boton = $("btnRegistrar");
    boton.disabled = true;
    loader.mostrar("Registrando usuario...");

    const resp = await api("Registro/usuario", { metodo: "POST", cuerpo, auth: false });

    if (resp.ok) {
        loader.mostrar("¡Registro completado con éxito!");
        aviso("aviso", "exito", resp.datos?.mensaje || "Registro completado con éxito.");
        setTimeout(() => { window.location.href = "../index.html"; }, 1200);
        return;
    }

    loader.ocultar();
    boton.disabled = false;
    aviso("aviso", "error", resp.mensaje || "No se pudo completar el registro.");
}

// ---------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
    $("fecha_nacimiento").max = hoyISO();
    llenarTiposSangre($("Tipo_Sangre"));
    activarOjosPassword();
    activarMedidorPassword($("password"), $("fuerzaBarra"), $("fuerzaTexto"));

    form.querySelectorAll('input[name="rol"]').forEach((r) => r.addEventListener("change", alCambiarRol));
    form.addEventListener("submit", enviar);
    form.addEventListener("input", (e) => e.target.removeAttribute?.("aria-invalid"));

    await ubicacion.cargarDepartamentos();
});
