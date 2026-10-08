// Variable global para almacenar temporalmente los pacientes de la consulta y agilizar el filtro
let listaPacientesGlobal = [];
var datosmedicos = {};

function cerrarSesion() {
    localStorage.removeItem("token_seguridad");
    localStorage.removeItem("usuario_id");
    window.location.href = "../index.html";
}

document.addEventListener("DOMContentLoaded", async function () {
    const token = localStorage.getItem("token_seguridad");
    const btnLogout = document.getElementById("btnCerrarSesion");
    if (btnLogout) {
        btnLogout.addEventListener("click", cerrarSesion);
    }

    // Validación estricta de sesión antes de cargar el panel
    if (!token) {
        alert("Acceso no autorizado. Inicie sesión nuevamente.");
        //window.location.href = "../index.html";
        return;
    }
    await cargarMedico();
    await cargarDashboardMedico();

    // 2. FILTRO EN TIEMPO REAL DESDE EL CAMPO DE TEXTO DEL HTML
    const inputBuscar = document.getElementById("txtBuscarPaciente");
    if (inputBuscar) {
        inputBuscar.addEventListener("input", function (e) {
            const terminoBusqueda = e.target.value.toLowerCase().trim();
            const filas = document.querySelectorAll("#listaPacientes tr");

            filas.forEach(fila => {
                // Captura el nombre del paciente dentro de la celda de la fila correspondiente
                const nombrePaciente = fila.querySelector(".patient-cell span")?.textContent.toLowerCase() || "";

                if (nombrePaciente.includes(terminoBusqueda)) {
                    fila.style.display = ""; // Muestra la fila si coincide
                } else {
                    fila.style.display = "none"; // Oculta la fila si no coincide
                }
            });
        });
    }
});

async function cargarPacientes() {
    // 1. Apuntamos al contenedor correcto de la pestaña "Añadir Pacientes"
    const contenedor = document.getElementById('listaPacientesGlobales');
    if (!contenedor) return;

    try {
        const token = localStorage.getItem("token_seguridad");
        const id = localStorage.getItem("usuario_id");
        const respuesta = await fetch(`${API_URL}Medico/pacientes/${id}`, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token.trim(),
                "Content-Type": "application/json"
            }
        });

        if (!respuesta.ok) {
            throw new Error('Error al obtener los datos de la API');
        }
        const todospacientes = await respuesta.json();

        const persona = datosmedicos.persona || datosmedicos.Persona;

        const idPersonaMedico = persona ? persona.idPersona : null;

        // Filtramos comparando el idUsuario del paciente con el idPersona del médico
        const pacientes = todospacientes.filter(e => Number(e.idUsuario) != Number(idPersonaMedico));


        // Esto te ayudará a inspeccionar el objeto completo en la consola
        console.log("Datos de pacientes recibidos:", pacientes);

        // Si la API devuelve una lista vacía
        if (pacientes.length === 0) {
            contenedor.innerHTML = `
                <tr>
                    <td colspan="3" style="color: #64748b; text-align: center; padding: 20px;">
                        No tiene pacientes asignados.
                    </td>
                </tr>`;
            return;
        }

        contenedor.innerHTML = pacientes.map(p => {
            const nombreCompleto = getFullName(p);

            // Validamos el nombre de la propiedad cuidando las mayúsculas de tu backend (TipoSangre o tipoSangre)
            const tipoSangre = p.tipoSangre || p.TipoSangre || 'No registrado';

            // Obtenemos el ID del paciente cuidando las mayúsculas/minúsculas que envía tu C#
            const idPaciente = p.idPaciente || p.IdPaciente;
            const ciudad = p.departamento.departamento1 + " / " +p.ciudad.nombre;
            return `
        <tr>
            <td><strong>${nombreCompleto}</strong></td>
            <td style="text-align: center;">
                <span class="badge bg-light text-dark border" style="font-size: 0.9rem; padding: 5px 10px;">
                    ${tipoSangre}
                </span>
            </td>

            <td style="text-align: center;">
                <span class="badge bg-light text-dark border" style="font-size: 0.9rem; padding: 5px 10px;">
                    ${ciudad}
                </span>
            </td>

            <td style="text-align: center;">
                <button class="btn btn-info btn-sm text-white" onclick="asociarNuevoPaciente(${idPaciente})">
                    ➕ Añadir
                </button>
            </td>
        </tr>
    `;
        }).join('');



    } catch (error) {
        console.error('Error:', error);
        // Usamos el contenedor correcto también en el bloque de error
        if (contenedor) {
            contenedor.innerHTML = `
                <tr>
                    <td colspan="3" style="color: #ef4444; text-align: center; padding: 20px;">
                        Error al cargar los pacientes desde el servidor.
                    </td>
                </tr>`;
        }
    }
}


async function cargarMedico() {
    try {
        const token = localStorage.getItem("token_seguridad");
        const id = localStorage.getItem("usuario_id");
        if (!token || !id) {
            console.error("No se encontró el token o el ID del usuario en el almacenamiento local.");
            return;
        }

        const respuesta = await fetch(`${API_URL}Medico/MisDatos/${id}`, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token.trim(),
                "Content-Type": "application/json"
            }

        });

        if (respuesta.ok) {
            datosmedicos = await respuesta.json();
            console.log("Datos recibidos del servidor:", datosmedicos);

            const persona = datosmedicos.Persona || datosmedicos.persona;

            if (persona) {
                var nombremedico = getFullName(persona);
                document.getElementById("txtMedico").innerText = `Dr(a). ${nombremedico}`;
            } else {
                console.warn("La respuesta no contiene el nodo 'Persona'.");
            }

        } else {
            console.error("Error en la respuesta del servidor:", respuesta.status);
            // Opcional: ver el texto exacto del error que configuramos en C#
            const errorTexto = await respuesta.text();
            console.error("Detalle del error del servidor:", errorTexto);
        }
    }
    catch (error) {
        console.error("Error en la petición fetch:", error);
    }
}



// FUNCIÓN PRINCIPAL DE CONEXIÓN CON EL BACKEND (MÉDICO)
async function cargarDashboardMedico() {
    const token = localStorage.getItem("token_seguridad");
    const cuerpoTabla = document.getElementById("listaPacientes");
    const id = localStorage.getItem("usuario_id");
    if (!cuerpoTabla) return;
    cuerpoTabla.innerHTML = "";

    try {
        const respuesta = await fetch(`${API_URL}Medico/mis-pacientes/${id}`, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token.trim(),
                "Content-Type": "application/json"
            }
        });

        if (respuesta.status === 401 || respuesta.status === 403) {
            alert("Sesión no válida, expirada o sin permisos suficientes.");
            return;
        }

        if (respuesta.ok) {
            const pacientes = await respuesta.json();
            listaPacientesGlobal = pacientes;
            let conteoAnemia = 0;
            let conteoPoliglobulia = 0;
            let conteoNormal = 0;

            if (!pacientes || pacientes.length === 0) {
                document.getElementById("lblTotalPacientes").innerText = "0";
                document.getElementById("graficoDonut").style.display = "none";
                document.getElementById("mensajeSinPacientes").style.display = "block";
                cuerpoTabla.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b; padding:20px;">No tiene pacientes asignados.</td></tr>`;
                return;
            }

            document.getElementById("lblTotalPacientes").innerText = pacientes.length;
            document.getElementById("graficoDonut").style.display = "block";
            document.getElementById("mensajeSinPacientes").style.display = "none";

            pacientes.forEach(p => {
                let badgeEstilo = "";
                let colorAvatar = "";
                let estado = p.estadoSalud || "Normal";

                if (estado === "Anemia") {
                    conteoAnemia++;
                    badgeEstilo = "badge-anemia";
                    colorAvatar = "var(--color-anemia)";
                } else if (estado === "Poliglobulia") {
                    conteoPoliglobulia++;
                    badgeEstilo = "badge-poliglobulia";
                    colorAvatar = "var(--color-poliglobulia)";
                } else {
                    conteoNormal++;
                    badgeEstilo = "badge-normal";
                    colorAvatar = "var(--color-normal)";
                    estado = "Normal";
                }

                const hbValor = p.tipoSangre ? p.tipoSangre : "Sin registros";
                const nombreCompleto = getFullName(p);
                const letraInicial = nombreCompleto.charAt(0).toUpperCase();
                const ciudad =p.departamento.departamento1+" / "+p.ciudad.nombre;
                // CORREGIDO: Aseguramos el ID correcto que viene del objeto de la iteración
                const idPacienteActual = p.idUsuario || p.idPaciente || p.IdPaciente;

                const fila = document.createElement("tr");
                fila.title = `Doble clic para desvincular la relación médica con ${nombreCompleto}`;
                fila.style.cursor = "pointer";

                // CORREGIDO: Se cambió \({idPaciente} por\){idPacienteActual} y el texto/estilo a "Quitar"
                fila.innerHTML = `
                    <td>
                        <div class="patient-cell">
                            <div class="avatar" style="background-color: ${colorAvatar};">${letraInicial}</div>
                            <span>${nombreCompleto}</span>
                        </div>
                    </td>
                    <td style="text-align: center;" class="hb-value">${hbValor}</td>
                    <td style="text-align: center;" class="hb-value">${ciudad}</td>
                    <td style="text-align: center;"><span class="badge ${badgeEstilo}">${estado}</span></td>
                    <td style="text-align: center;">
                        <button class="btn btn-danger btn-sm text-white" onclick="eliminarPacienteRelacion(${idPacienteActual}, '${nombreCompleto}')">
                            ❌ Quitar
                        </button>
                    </td>
                `;

                fila.addEventListener("dblclick", () => {
                    if (confirm(`¿Deseas desvincular por completo al paciente ${nombreCompleto} de tu cuenta?`)) {
                        eliminarPacienteRelacion(idPacienteActual, nombreCompleto);
                    }
                });

                cuerpoTabla.appendChild(fila);
            });

            const total = conteoNormal + conteoAnemia + conteoPoliglobulia;
            if (total > 0) {
                const porcNormal = (conteoNormal / total) * 100;
                const porcAnemia = (conteoAnemia / total) * 100;

                const finNormal = porcNormal;
                const finAnemia = finNormal + porcAnemia;

                const donut = document.getElementById("graficoDonut");
                if (donut) {
                    donut.title = `Distribución actual:\n• Normales: ${conteoNormal}\n• Anemia: ${conteoAnemia}\n• Poliglobulia: ${conteoPoliglobulia}`;
                    donut.style.background = `conic-gradient(
                        var(--color-normal) 0% ${finNormal}%, 
                        var(--color-anemia) ${finNormal}% ${finAnemia}%, 
                        var(--color-poliglobulia) ${finAnemia}% 100%
                    )`;
                }
            }

        } else {
            document.getElementById("lblTotalPacientes").innerText = "0";
            document.getElementById("graficoDonut").style.display = "none";
            document.getElementById("mensajeSinPacientes").style.display = "block";
            cuerpoTabla.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b; padding:20px;">No se encontraron registros de pacientes asignados.</td></tr>`;
        }
    } catch (error) {
        console.error("Error crítico de comunicación de red:", error);
        cuerpoTabla.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#ef4444; padding:20px;">Fallo de conexión con el servidor.</td></tr>`;
    }
}



async function eliminarPacienteRelacion(idUsuario) {
    const token = localStorage.getItem("token_seguridad");

    try {
        const respuesta = await fetch(`${API_URL}Medico/borrar-paciente/${idUsuario}`, {
            method: "DELETE",
            headers: {
                "Authorization": "Bearer " + token.trim()
            }
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            alert(resultado.mensaje || `El paciente ${nombreCompleto} fue removido con éxito.`);
            await cargarDashboardMedico(); // Recarga reactiva de la interfaz
        } else {
            alert(resultado.mensaje || "No se pudo eliminar la relación médica.");
        }
    } catch (error) {
        console.error("Error en la solicitud de eliminación:", error);
        alert("Ocurrió un fallo de conexión al intentar remover el vínculo.");
    }
}

async function asociarNuevoPaciente(idUsuario) {
    if (!idUsuario) return;
    const token = localStorage.getItem("token_seguridad");

    try {
        // Petición POST al endpoint unificado del MedicoController
        const respuesta = await fetch(`${API_URL}Medico/añadir-paciente/${idUsuario}`, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token.trim(),
                "Content-Type": "application/json"
            }
        });

        // Desempaquetar la respuesta JSON del servidor
        const resultado = await respuesta.json();

        if (respuesta.ok) {
            // Notificar éxito al médico
            alert(resultado.mensaje || "Paciente añadido correctamente a tu lista de seguimiento.");

            // Recargar el panel de manera reactiva para actualizar la tabla y el gráfico cónico
            await cargarDashboardMedico();
        } else {
            // Manejar errores de negocio controlados por el backend (Ej: 400 Duplicados, 404 No existe)
            alert(resultado.mensaje || "Error al intentar asociar el paciente.");
        }
    } catch (error) {
        // Captura de fallas críticas de red o caídas del servidor
        console.error("Error en la solicitud de adición:", error);
        alert("Ocurrió un fallo crítico de conexión al intentar añadir el paciente.");
    }
}

function cambiarPestana(pestana) {
    // 1. Capturamos los elementos del HTML
    const tabMis = document.getElementById('tabMisPacientes');
    const tabAnadir = document.getElementById('tabAnadirPacientes');
    const vistaMis = document.getElementById('vistaMisPacientes');
    const vistaAnadir = document.getElementById('vistaAnadirPacientes');


    if (pestana === 'mis-pacientes') {

        vistaMis.style.display = 'block';
        vistaAnadir.style.display = 'none';


        tabMis.style.color = '#1e293b';
        tabMis.style.fontWeight = '600';
        tabMis.style.borderBottom = '2px solid #818cf8';

        tabAnadir.style.color = '#64748b';
        tabAnadir.style.fontWeight = '500';
        tabAnadir.style.borderBottom = 'none';


        cargarDashboardMedico();

    } else if (pestana === 'anadir-pacientes') {
        // Mostramos la vista de Añadir Pacientes y ocultamos la otra
        vistaMis.style.display = 'none';
        vistaAnadir.style.display = 'block';

        // Cambiamos los estilos visuales de los botones (Foco en Añadir Pacientes)
        tabAnadir.style.color = '#1e293b';
        tabAnadir.style.fontWeight = '600';
        tabAnadir.style.borderBottom = '2px solid #818cf8';

        tabMis.style.color = '#64748b';
        tabMis.style.fontWeight = '500';
        tabMis.style.borderBottom = 'none';

        // Ejecutamos la carga de la API para traer los pacientes globales
        cargarPacientes();
    }
}



function filtrarPacientes() {
    // Obtener el texto que escribió el usuario (en minúsculas para que no importen las mayúsculas)
    const textoBusqueda = document.getElementById("txtBuscarPaciente").value.toLowerCase().trim();
    
    // Identificar cuál pestaña está visible actualmente
    const vistaMisPacientes = document.getElementById("vistaMisPacientes");
    const esPestanaMisPacientes = (vistaMisPacientes && vistaMisPacientes.style.display !== "none");

    if (esPestanaMisPacientes) {

        const cuerpoTablaMis = document.getElementById("listaPacientes");
        if (!cuerpoTablaMis) return;

        // Si el buscador está vacío, volvemos a cargar el dashboard completo
        if (textoBusqueda === "") {
            cargarDashboardMedico();
            return;
        }

   
        const resultadosFiltrados = listaPacientesGlobal.filter(p => {
            const nombreCompleto = getFullName(p).toLowerCase();
            return nombreCompleto.includes(textoBusqueda);
        });

        cuerpoTablaMis.innerHTML = "";
        
        if (resultadosFiltrados.length === 0) {
            cuerpoTablaMis.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b; padding:20px;">No se encontraron coincidencias.</td></tr>`;
            return;
        }

        resultadosFiltrados.forEach(p => {
            let badgeEstilo = p.estadoSalud === "Anemia" ? "badge-anemia" : p.estadoSalud === "Poliglobulia" ? "badge-poliglobulia" : "badge-normal";
            let colorAvatar = p.estadoSalud === "Anemia" ? "var(--color-anemia)" : p.estadoSalud === "Poliglobulia" ? "var(--color-poliglobulia)" : "var(--color-normal)";
            const nombreCompleto = getFullName(p);
            const idPacienteActual = p.idUsuario || p.idPaciente || p.IdPaciente;

            const fila = document.createElement("tr");
            fila.innerHTML = `
                <td>
                    <div class="patient-cell">
                        <div class="avatar" style="background-color: ${colorAvatar};">${nombreCompleto.charAt(0).toUpperCase()}</div>
                        <span>${nombreCompleto}</span>
                    </div>
                </td>
                <td style="text-align: center;" class="hb-value">${p.tipoSangre || "Sin registros"}</td>
                <td style="text-align: center;"><span class="badge ${badgeEstilo}">${p.estadoSalud || "Normal"}</span></td>
                <td style="text-align: center;">
                    <button class="btn btn-danger btn-sm text-white" onclick="eliminarPacienteRelacion(${idPacienteActual}, '${nombreCompleto}')">
                        ❌ Quitar
                    </button>
                </td>
            `;
            cuerpoTablaMis.appendChild(fila);
        });

    } else {

        const cuerpoTablaGlobales = document.getElementById("listaPacientesGlobales");
        if (!cuerpoTablaGlobales) return;

        if (textoBusqueda === "") {
            cargarPacientes(); 
            return;
        }

        // Buscamos los renglones correspondientes dentro de la tabla actual
        const filas = cuerpoTablaGlobales.getElementsByTagName("tr");

        for (let i = 0; i < filas.length; i++) {

            const celdaNombre = filas[i].getElementsByTagName("td")[0];
            if (celdaNombre) {
                const textoNombre = celdaNombre.textContent || celdaNombre.innerText;
                

                if (textoNombre.toLowerCase().includes(textoBusqueda)) {
                    filas[i].style.display = "";
                } else {
                    filas[i].style.display = "none";
                }
            }
        }
    }
}

function editarPefil()
{
    window.location.href="EditarMedico.html";
}

function getFullName(persona){
    return  `${persona.nombre || ''} ${persona.paterno || ''} ${persona.materno || ''}`.trim() || 'Paciente sin nombre';
}