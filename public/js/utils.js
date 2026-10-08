export function getFullName(persona){
    return  `${persona.nombre || ''} ${persona.paterno || ''} ${persona.materno || ''}`.trim() || 'Paciente sin nombre';
}