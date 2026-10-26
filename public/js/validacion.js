// Reglas de validación compartidas (las mismas que aplica la API).

export const REGEX = {
    soloTexto: /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/,
    correo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,16}$/
};

export const MENSAJE_PASSWORD =
    "La contraseña debe tener entre 8 y 16 caracteres, con mayúscula, minúscula, número y un carácter especial.";

/** Valida un nombre o apellido. Devuelve el mensaje de error o "" si está bien. */
export function validarNombre(valor, etiqueta, { obligatorio = false } = {}) {
    if (!valor) return obligatorio ? `${etiqueta} es obligatorio.` : "";
    if (valor.length < 2) return `${etiqueta} debe tener al menos 2 caracteres.`;
    if (valor.length > 30) return `${etiqueta} no debe exceder los 30 caracteres.`;
    if (!REGEX.soloTexto.test(valor)) return `${etiqueta} solo puede contener letras y espacios.`;
    return "";
}

export function validarCorreo(valor, { obligatorio = true } = {}) {
    if (!valor) return obligatorio ? "El correo electrónico es obligatorio." : "";
    if (valor.length > 100) return "El correo electrónico no debe exceder los 100 caracteres.";
    if (!REGEX.correo.test(valor)) return "Ingresa un correo válido (ejemplo@correo.com).";
    return "";
}

export function validarFechaNacimiento(valor, { obligatorio = true } = {}) {
    if (!valor) return obligatorio ? "Ingresa tu fecha de nacimiento." : "";
    const fecha = new Date(`${valor}T00:00:00`);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (Number.isNaN(fecha.getTime())) return "La fecha de nacimiento no es válida.";
    if (fecha > hoy) return "La fecha de nacimiento no puede ser futura.";
    if (fecha.getFullYear() < 1900) return "La fecha de nacimiento no es válida.";
    return "";
}

/** Contraseña + confirmación. Con {opcional:true} se permite dejarlas vacías (edición de perfil). */
export function validarPassword(password, confirmacion, { opcional = false } = {}) {
    if (opcional && !password && !confirmacion) return "";
    if (!REGEX.password.test(password)) return MENSAJE_PASSWORD;
    if (password !== confirmacion) return "Las contraseñas no coinciden.";
    return "";
}
