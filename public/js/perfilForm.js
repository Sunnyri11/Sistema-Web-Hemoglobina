// Lógica común de "Editar perfil" (paciente y médico): leer, rellenar y validar los campos del formulario.
import { $, hoyISO } from "./utils.js";
import { SelectorUbicacion } from "./geografia.js";
import { validarNombre, validarCorreo, validarFechaNacimiento, validarPassword } from "./validacion.js";

export function crearUbicacion() {
    return new SelectorUbicacion({
        departamento: $("departamento"),
        ciudad: $("provincia"),
        altitud: $("altitud")
    });
}

/** Rellena nombre, apellidos, género, fecha, correo y ubicación con la respuesta de MisDatos. */
export async function rellenarPerfil(datos, ubicacion) {
    const persona = datos.persona ?? datos.Persona ?? {};
    $("nombre").value = persona.nombre ?? "";
    $("paterno").value = persona.paterno ?? "";
    $("materno").value = persona.materno ?? "";

    const genero = Number(persona.idGenero);
    if (genero === 1) $("genero_masculino").checked = true;
    if (genero === 2) $("genero_femenino").checked = true;

    const fecha = datos.fechaNacimiento?.fechaDeNacimiento;
    if (fecha) $("fecha_nacimiento").value = String(fecha).split("T")[0];

    $("correo").value = datos.correo?.correoElectronico ?? "";

    await ubicacion.seleccionar(datos.departamento?.idDepartamento, datos.ciudad?.idCiudad ?? persona.idCiudad);
}

export function iniciarCamposComunes() {
    $("fecha_nacimiento").max = hoyISO();
}

/** Valores del formulario. Los textos vacíos se envían como null (la API conserva el dato actual). */
export function leerPerfil(ubicacion) {
    const texto = (id) => $(id).value.trim();
    return {
        nombre: texto("nombre"),
        paterno: texto("paterno"),
        materno: texto("materno"),
        genero: Number(document.querySelector('input[name="genero"]:checked')?.value) || null,
        fecha: $("fecha_nacimiento").value,
        idCiudad: ubicacion.idCiudad || null,
        provincia: ubicacion.textoCiudad || null,
        altitud: $("altitud").value === "" ? null : parseFloat($("altitud").value),
        correo: texto("correo"),
        password: $("password").value,
        confirmacion: $("confirm_password").value
    };
}

/** Primer error del formulario como { campo, mensaje }, o null si todo está bien. */
export function validarPerfil(d, ubicacion) {
    const comprobaciones = [
        ["nombre", validarNombre(d.nombre, "El nombre", { obligatorio: true })],
        ["paterno", validarNombre(d.paterno, "El apellido paterno", { obligatorio: true })],
        ["materno", validarNombre(d.materno, "El apellido materno")],
        ["fecha_nacimiento", validarFechaNacimiento(d.fecha)],
        ["provincia", ubicacion.idCiudad ? "" : "Selecciona tu departamento y ciudad."],
        ["altitud", d.altitud !== null && (Number.isNaN(d.altitud) || d.altitud < 0) ? "La altitud no puede ser negativa." : ""],
        ["correo", validarCorreo(d.correo)],
        ["password", validarPassword(d.password, d.confirmacion, { opcional: true })]
    ];
    const falla = comprobaciones.find(([, mensaje]) => mensaje);
    return falla ? { campo: falla[0], mensaje: falla[1] } : null;
}

export function marcarInvalido(idCampo) {
    document.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    const el = $(idCampo);
    if (!el) return;
    const foco = el.matches("input, select") ? el : el.querySelector("select, input");
    if (el.matches("input, select")) el.setAttribute("aria-invalid", "true");
    foco?.focus();
}

/** Cuerpo base de PUT (lo que ambos endpoints entienden). */
export function cuerpoPerfil(d, idEntidad) {
    return {
        IdUsuario: Number(idEntidad),
        Nombre: d.nombre,
        ApellidoPaterno: d.paterno,
        ApellidoMaterno: d.materno,
        Genero: d.genero,
        FechaNacimiento: d.fecha || null,
        IdCiudad: d.idCiudad,
        Provincia: d.provincia,
        Altitud: d.altitud,
        Correo: d.correo,
        Password: d.password || null
    };
}
