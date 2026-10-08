export function getFullName(persona){
    return  `${persona.nombre || ''} ${persona.paterno || ''} ${persona.materno || ''}`.trim() || 'Paciente sin nombre';
}

export function cerrarSesion() {
    localStorage.removeItem("token_seguridad");
    localStorage.removeItem("usuario_id");
    window.location.href = "../index.html";
}