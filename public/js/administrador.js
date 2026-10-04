// Listas globales en memoria para permitir el filtrado en tiempo real sin recargar de la API
let listaPacientesGlobal = [];
let listaMedicosGlobal = [];

function cerrarSesion() {
    localStorage.removeItem("token_seguridad");
    localStorage.removeItem("usuario_id");
    window.location.href = "../index.html";
}

document.addEventListener("DOMContentLoaded", async function () {
    const token = localStorage.getItem("token_seguridad");

    // Configurar evento de cierre de sesión
    const btnLogout = document.getElementById("btnCerrarSesion");
    if (btnLogout) {
        btnLogout.addEventListener("click", cerrarSesion);
    }

    // Validación estricta de seguridad en el cliente
    if (!token) {
        alert("Acceso denegado. Inicie sesión con credenciales de Administrador.");
        window.location.href = "../index.html";
        return;
    }

    try {
        cargarAdministrador();
        // Petición al endpoint consolidado del Administrador
        const respuesta = await fetch(`${API_URL}Dashboard/administrador`, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token.trim(),
                "Content-Type": "application/json"
            }
        });

        if (respuesta.ok) {
            const datos = await respuesta.json();

            // 1. Renderizar información básica y métricas globales
            document.getElementById("lblTotalPacientes").innerText = datos.metricasGlobales.totalPacientes;
            document.getElementById("lblTotalMedicos").innerText = datos.metricasGlobales.totalMedicos;
            document.getElementById("lblAlertasRiesgo").innerText = datos.metricasGlobales.alertasRiesgo;

            // 2. Almacenar los arreglos en las variables globales para los filtros de búsqueda
            listaPacientesGlobal = datos.pacientes || [];
            listaMedicosGlobal = datos.medicos || [];

            // 3. Renderizar las tablas inicialmente con todos los datos
            inyectarTablaPacientes(listaPacientesGlobal);
            inyectarTablaMedicos(listaMedicosGlobal);

            // 4. Activar el motor de búsqueda en tiempo real al escribir
            document.getElementById("buscadorGeneral").addEventListener("input", function (e) {
                const query = e.target.value.toLowerCase().trim();
                filtrarDatos(query);
            });

        } else {
            alert("Su sesión administrativa ha expirado o no es válida.");
            cerrarSesion();
        }
    } catch (error) {
        console.error("Error crítico de comunicación con la API:", error);
        alert("No se pudo establecer conexión con el servidor central.");
    }
});

async function cargarAdministrador()
{
    try {
        const token = localStorage.getItem("token_seguridad");
        const id = localStorage.getItem("usuario_id");
        if (!token || !id) {
            console.error("No se encontró el token o el ID del usuario en el almacenamiento local.");
            return;
        }

        // CORREGIDO: Apuntamos al endpoint correspondiente
        const respuesta = await fetch(`${API_URL}Administrador/MisDatos/${id}`, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token.trim(),
                "Content-Type": "application/json"
            }
        });

        if (respuesta.ok) {
            datosadmin = await respuesta.json();
            console.log("Datos recibidos del servidor:", datosadmin);
            var datos = datosadmin.usuario; 
            console.log(datos);
            var nombreAdmin= datos.nombre + " " + datos.apellido;
            document.getElementById("txtAdmin").innerText = `Bienvenido, ${nombreAdmin}`;
        }
    }
    catch (error) {
        console.error("Error en la petición fetch de datos personales:", error);
    }
}


// --- RENDERIZADO DINÁMICO DE LA TABLA DE PACIENTES ---
function inyectarTablaPacientes(pacientes) {
    const tbody = document.getElementById("tbodyPacientes");
    tbody.innerHTML = "";

    if (pacientes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 40px;">No se encontraron pacientes que coincidan.</td></tr>`;
        return;
    }

    pacientes.forEach(p => {
        // Corrección de acceso: .datosPersonales viene como .datosPersonales (minúscula inicial)
        const dp = p.datosPersonales || {};
        const nombreCompleto = `${dp.nombre || ''} ${dp.apellido || ''}`.trim() || "Paciente sin nombre";
        
        // Mapeo seguro de arreglos serializados en camelCase
        const historial = p.historialHemoglobina || [];
        const medicos = p.medicosAsignados || [];

        // Convertir arreglos internos a formato JSON string de manera segura
        const historialString = encodeURIComponent(JSON.stringify(historial));
        const medicosString = encodeURIComponent(JSON.stringify(medicos));

        const fila = `
            <tr>
                <td><strong>${nombreCompleto}</strong></td>
                <td>
                    <div style="font-size: 13px;">${dp.correo || 'Sin correo'}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">Nacimiento: ${dp.fechaNacimiento || 'No registrada'}</div>
                </td>
                <td>${dp.genero || 'N/A'}</td>
                <td style="text-align: center;"><span class="badge-blood">${p.tipoSangre || '--'}</span></td>
                <td style="text-align: center;">
                    <button class="btn-action" onclick="mostrarMedicosAsignados('${nombreCompleto.replace(/'/g, "\\'")}', '${medicosString}')">
                        Ver (${medicos.length})
                    </button>
                </td>
                <td style="text-align: center;">
                    <button class="btn-action" style="background-color: #1e293b;" onclick="mostrarHistorialPaciente('${nombreCompleto.replace(/'/g, "\\'")}', '${historialString}')">
                        Historial (${historial.length})
                    </button>
                </td>
            </tr>
        `;
        tbody.innerHTML += fila;
    });
}


// --- RENDERIZADO DINÁMICO DE LA TABLA DE MÉDICOS ---
function inyectarTablaMedicos(medicos) {
    const tbody = document.getElementById("tbodyMedicos");
    tbody.innerHTML = "";

    if (medicos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 40px;">No se encontraron médicos que coincidan.</td></tr>`;
        return;
    }

    medicos.forEach(m => {
        const dp = m.datosPersonales || {};
        const nombreCompleto = `Dr(a). ${dp.nombre || ''} ${dp.apellido || ''}`.trim();
        
        // Mapear especialidades desde camelCase
        const especs = m.especialidades || [];
        const especialidadesHtml = especs.length > 0 
            ? especs.map(esp => `<span style="background-color:#111827; border: 1px solid #1f2937; padding: 2px 8px; border-radius: 4px; font-size:11px; margin-right:4px;">${esp}</span>`).join('')
            : '<span style="color: var(--text-muted); font-size:12px;">General / Ninguna</span>';

        const fila = `
            <tr>
                <td><strong>${nombreCompleto}</strong></td>
                <td style="color: var(--text-muted);">${dp.correo || 'Sin correo'}</td>
                <td>${dp.fechaNacimiento || 'N/A'}</td>
                <td><div style="display: flex; flex-wrap: wrap; gap: 4px;">${especialidadesHtml}</div></td>
                <td style="text-align: center;">
                    <span style="font-weight: 700; color: var(--accent-primary); font-size: 15px;">${m.totalPacientesACargo || 0}</span>
                </td>
            </tr>
        `;
        tbody.innerHTML += fila;
    });
}

// --- DESPLEGAR HISTORIAL DE HEMOGLOBINA EN EL MODAL ---
window.mostrarHistorialPaciente = function (nombrePaciente, historialEncoded) {
    const historial = JSON.parse(decodeURIComponent(historialEncoded));
    
    document.getElementById("modalHistorialTitulo").innerText = `Historial Clínico: ${nombrePaciente}`;
    const cuerpoModal = document.getElementById("modalHistorialCuerpo");
    cuerpoModal.innerHTML = "";

    if (historial.length === 0) {
        cuerpoModal.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 20px;">Este paciente no registra análisis de laboratorio.</td></tr>`;
    } else {
        historial.forEach(h => {
            // Mapeo corregido a las propiedades del DTO en minúsculas iniciales
            const valor = h.valorHemoglobina || "0.00";
            const rango = h.rangoReferencia || {};
            const min = rango.valorMin !== undefined ? rango.valorMin : "--";
            const max = rango.valorMax !== undefined ? rango.valorMax : "--";
            
            cuerpoModal.innerHTML += `
                <tr>
                    <td>${h.fechaAnalisis || 'Sin fecha'}</td>
                    <td style="text-align: center; font-weight:700; color: var(--text-main);">${valor} g/dL</td>
                    <td style="text-align: center; color: var(--text-muted); font-size:13px;">${min} - ${max}</td>
                </tr>
            `;
        });
    }
    abrirModal("modalHistorial");
};

// --- DESPLEGAR MÉDICOS ASIGNADOS EN EL MODAL ---
window.mostrarMedicosAsignados = function (nombrePaciente, medicosEncoded) {
    const medicos = JSON.parse(decodeURIComponent(medicosEncoded));
    const contenedorLista = document.getElementById("modalMedicosLista");
    contenedorLista.innerHTML = "";

    if (medicos.length === 0) {
        contenedorLista.innerHTML = `<div style="text-align:center; color: var(--text-muted); padding:10px;">Este paciente no tiene médicos especialistas asignados.</div>`;
    } else {
        medicos.forEach(m => {
            // Corrección: leer nombreMedico con minúscula inicial
            cuerpoModal = `
                <div style="background-color: var(--bg-tabla-header); border: 1px solid var(--border-color); padding: 12px 16px; border-radius: 8px; font-weight: 600;">
                    <span style="color: var(--accent-primary); margin-right: 8px;">✦</span> ${m.nombreMedico || 'Médico Asignado'}
                </div>
            `;
            contenedorLista.innerHTML += cuerpoModal;
        });
    }
    abrirModal("modalMedicosAsignados");
};

