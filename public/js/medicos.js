import { getFullName, cerrarSesion } from './utils.js';
// Variable global para almacenar temporalmente los pacientes de la consulta y agilizar el filtro
let listaPacientesGlobal = [];
var datosmedicos = {};

//Asignacion Botones
function initButtons() {
    const btnLogout = document.getElementById("btnCerrarSesion");
    if (btnLogout) {
        btnLogout.addEventListener("click", cerrarSesion);
    }

    const btnEdit = document.getElementById("btnEditarPerfil");
    if (btnEdit) { btnEdit.addEventListener("click", editarPefil); }


    const tabMis = document.getElementById('tabMisPacientes');
    const tabAnadir = document.getElementById('tabAnadirPacientes');

    if (tabMis) {
        tabMis.addEventListener("click", () => cambiarPestana('mis-pacientes'));
    }

    if (tabAnadir) {
        tabAnadir.addEventListener("click", () => cambiarPestana('anadir-pacientes'));
    }

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
        inputBuscar.addEventListener("input", filtrarPacientes);
    }
}

document.addEventListener("DOMContentLoaded", async function () {
    const token = localStorage.getItem("token_seguridad");

    // Validación estricta de sesión antes de cargar el panel
    if (!token) {
        alert("Acceso no autorizado. Inicie sesión nuevamente.");
        //window.location.href = "../index.html";
        return;
    }
    await cargarMedico();
    await cargarDashboardMedico();

    initButtons();
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
        console.log(todospacientes);
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
            const ciudad = p.departamento.departamento1 + " / " + p.ciudad.nombre;
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
            console.log(listaPacientesGlobal);
            let conteoAnemia = 0;
            let conteoPoliglobulia = 0;
            let conteoNormal = 0;

            if (!pacientes || pacientes.length === 0) {
                document.getElementById("lblTotalPacientes").innerText = "0";
                document.getElementById("graficoDonut").style.display = "none";
                document.getElementById("mensajeSinPacientes").style.display = "block";
                cuerpoTabla.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b; padding:20px;">No tiene pacientes asignados.</td></tr>`;
                return;
            }

            document.getElementById("lblTotalPacientes").innerText = pacientes.length;
            document.getElementById("graficoDonut").style.display = "block";
            document.getElementById("mensajeSinPacientes").style.display = "none";

            pacientes.forEach(p => {
                let badgeEstilo = "";
                let colorAvatar = "";
                let estado = "Normal";
                let HbMostrar = "Sin registros";
                let fecha = "Sin registros";
                if (p.historialHemoglobinas && p.historialHemoglobinas.length > 0) {
                    const ultimoHistorial = p.historialHemoglobinas[p.historialHemoglobinas.length - 1];
                    HbMostrar = `${ultimoHistorial.valor} g/dL`;
                    fecha = ultimoHistorial.fecha;
                    console.log(fecha);
                    const valor = ultimoHistorial.valor;
                    const rango = ultimoHistorial.rango;

                    if (rango) {
                        if (valor < rango.minimo) {
                            estado = "Anemia";
                        } else if (valor > rango.maximo) {
                            estado = "Poliglobulia";
                        } else {
                            estado = "Normal";
                        }
                    }
                } else {
                    HbMostrar = "Sin registros";
                }

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
                }

                const nombreCompleto = getFullName(p);
                const letraInicial = nombreCompleto.charAt(0).toUpperCase();
                const ciudad = p.departamento.departamento1 + " / " + p.ciudad.nombre;
                const idPacienteActual = p.idUsuario || p.idPersona;
                const tiposangrepaciente = p.tipoSangre;
                console.log(tiposangrepaciente);
                const fila = document.createElement("tr");
                fila.title = `Doble clic para desvincular la relación médica`;
                fila.style.cursor = "pointer";

                // CORREGIDO: El botón ahora llama pasándole únicamente el ID numérico
                fila.innerHTML = `
                    <td>
                        <div class="patient-cell">
                            <div class="avatar" style="background-color: ${colorAvatar};">${letraInicial}</div>
                            <span>${nombreCompleto}</span>
                        </div>
                    </td>

                    <td style="text-align: center;" class="hb-value">${HbMostrar}</td>
                    <td id="fecha" style="text-align: center;" class="hb-value">${fecha}</td>                                       
                    <td style="text-align: center;" class="hb-value">${tiposangrepaciente}</td>
                    <td style="text-align: center;" class="hb-value">${ciudad}</td>
                    <td  style="text-align: center;"><span class="badge ${badgeEstilo}">${estado}</span></td>
                    <td style="text-align: center;">
                        <button class="btn btn-danger btn-sm text-white" onclick="eliminarPacienteRelacion(${idPacienteActual})">
                            ❌ Quitar
                        </button>
                    </td>
                `;

                // CORREGIDO: Se pasa únicamente el ID numérico en el evento manual
                fila.addEventListener("dblclick", () => {
                    if (confirm(`¿Deseas desvincular por completo al paciente de tu cuenta?`)) {
                        eliminarPacienteRelacion(idPacienteActual);
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
                    // 1. Limpiar porcentajes previos para que no se dupliquen
                    donut.innerHTML = "";

                    // 2. Calcular el total de registros actuales
                    const total = conteoNormal + conteoAnemia + conteoPoliglobulia;

                    // 3. Pintar el gráfico de pastel tradicional (sólido)
                    donut.style.background = `conic-gradient(
                        var(--color-normal) 0% ${finNormal}%, 
                        var(--color-anemia) ${finNormal}% ${finAnemia}%, 
                        var(--color-poliglobulia) ${finAnemia}% 100%
                        )`;

                    donut.title = `Distribución actual:\n• Normales: ${conteoNormal}\n• Anemia: ${conteoAnemia}\n• Poliglobulia: ${conteoPoliglobulia}`;

                    // 4. Mapeo con los porcentajes de INICIO y FIN reales de cada rebanada
                    if (total > 0) {
                        const categorias = [
                            { conteo: conteoNormal, desde: 0, hasta: finNormal },
                            { conteo: conteoAnemia, desde: finNormal, hasta: finAnemia },
                            { conteo: conteoPoliglobulia, desde: finAnemia, hasta: 100 }
                        ];

                        categorias.forEach(cat => {
                            if (cat.conteo > 0) {
                                // Calcular el porcentaje textual exacto
                                const porcentajeTexto = Math.round((cat.conteo / total) * 100) + "%";

                                // LÓGICA DE ÁNGULO CORREGIDA: Punto medio exacto de la rebanada actual
                                const puntoMedioPorcentaje = cat.desde + (cat.hasta - cat.desde) / 2;

                                // Convertir el porcentaje a grados (0-360) y restar 90 para que empiece arriba
                                const grados = (puntoMedioPorcentaje * 3.6) - 90;
                                const radianes = grados * (Math.PI / 180);

                                // Distancia desde el centro (28px es el radio ideal para un círculo de 180px)
                                const radioDistancia = 28;

                                // Calcular coordenadas en pixeles respecto al centro exacto (90, 90)
                                const x = 90 + radioDistancia * Math.cos(radianes);
                                const y = 90 + radioDistancia * Math.sin(radianes);

                                // Crear la etiqueta de texto e inyectarle estilos en línea para asegurar legibilidad
                                const etiqueta = document.createElement("span");
                                etiqueta.className = "porcentaje-pastel";
                                etiqueta.innerText = porcentajeTexto;

                                // Estilos forzados para garantizar posicionamiento y color blanco
                                etiqueta.style.position = "absolute";
                                etiqueta.style.left = `${x}px`;
                                etiqueta.style.top = `${y}px`;
                                etiqueta.style.color = "#ffffff";
                                etiqueta.style.fontWeight = "bold";
                                etiqueta.style.fontSize = "0.85rem";
                                etiqueta.style.transform = "translate(-50%, -50%)";
                                etiqueta.style.textShadow = "1px 1px 2px rgba(0,0,0,0.5)";

                                donut.appendChild(etiqueta);
                            }
                        });
                    }
                }
            }
        } else {
            document.getElementById("lblTotalPacientes").innerText = "0";
            document.getElementById("graficoDonut").style.display = "none";
            document.getElementById("mensajeSinPacientes").style.display = "block";
            cuerpoTabla.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b; padding:20px;">No se encontraron registros de pacientes asignados.</td></tr>`;
        }
    } catch (error) {
        console.error("Error crítico de comunicación de red:", error);
        cuerpoTabla.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444; padding:20px;">Fallo de conexión con el servidor.</td></tr>`;
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
            alert(resultado.mensaje || "El paciente fue removido con éxito.");
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
        const respuesta = await fetch(`${API_URL}Medico/añadir-paciente/${idUsuario}`, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token.trim(),
                "Content-Type": "application/json"
            }
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            alert(resultado.mensaje || "Paciente añadido correctamente a tu lista de seguimiento.");
            await cargarDashboardMedico();
        } else {
            alert(resultado.mensaje || "No se pudo asociar el paciente.");
        }
    } catch (error) {
        console.error("Error en la solicitud de asociación:", error);
        alert("Ocurrió un fallo de conexión al intentar vincular el paciente.");
    }
}

// Vinculación explícita al contexto global del navegador
window.cargarDashboardMedico = cargarDashboardMedico;
window.asociarNuevoPaciente = asociarNuevoPaciente;
window.eliminarPacienteRelacion = eliminarPacienteRelacion;

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

function editarPefil() {
    window.location.href = "EditarMedico.html";
}