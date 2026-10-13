var datosmedicos = {};
var verificacion;
var idciudade = 0;

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
    
    // Configurar listeners para los cambios manuales del usuario mediante código (sin inline onchange)
    const selectDepto = document.getElementById('departamento');
    if (selectDepto) {
        selectDepto.addEventListener('change', () => cargarProvincias());
    }

    const selectProvincia = document.getElementById('provincia');
    if (selectProvincia) {
        selectProvincia.addEventListener('change', actualizarAltitud);
    }

    // Cargar Departamentos automáticamente desde MySQL al abrir la página
    if (selectDepto) {
        try {
            const respuesta = await fetch(`${API_URL}geografia/departamentos`);
            if (respuesta.ok) {
                const departamentos = await respuesta.json();
                selectDepto.innerHTML = '<option value="" disabled selected>Seleccione departamento</option>';
                departamentos.forEach(d => {
                    let option = document.createElement('option');
                    option.value = d.idDepartamento;
                    option.textContent = d.nombre;
                    selectDepto.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Error al cargar departamentos:", error);
        }
    }
    
    await cargarMedico();
    await cargarEspecialidades(); 
});

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
            const med = datosmedicos.persona;
            console.log("Datos Medico:")
            console.log(med);
            document.getElementById("nombre").value = med.nombre;
            
            // Asignación de la variable de verificación
            verificacion = datosmedicos.veripaciente;
            console.log(verificacion);
            
            // Evaluamos el rol dinámicamente según la respuesta booleana obtenida
            evaluarRolPaciente(verificacion);
            
            const apellidoPaterno = med.paterno;
            const apellidoMaterno = med.materno;

            document.getElementById("paterno").value = apellidoPaterno;
            document.getElementById("materno").value = apellidoMaterno;

            const generoValor = Number(med.idGenero);

            if (generoValor === 1) {
                document.getElementById("genero_masculino").checked = true;
            } else if (generoValor === 2) {
                document.getElementById("genero_femenino").checked = true;
            }
            const fechaRaw = datosmedicos.fechaNacimiento?.fechaDeNacimiento;
            if (fechaRaw) {
                const fechaFormateada = fechaRaw.split('T')[0];
                document.getElementById("fecha_nacimiento").value = fechaFormateada;
            }
            var correo=datosmedicos.correo.correoElectronico;
            document.getElementById("correo").value=correo;
        } else {
            console.error("Error en la respuesta del servidor:", respuesta.status);
            const errorTexto = await respuesta.text();
            console.error("Detalle del error del servidor:", errorTexto);
        }
    }
    catch (error) {
        console.error("Error en la petición fetch:", error);
    }
}

// Cargar Provincias/Ciudades dinámicamente filtradas por el departamento seleccionando la precarga si existe
async function cargarProvincias() {
    const idDepto = document.getElementById('departamento').value;
    const selectProvincia = document.getElementById('provincia');
    const inputAltitud = document.getElementById('altitud');

    if (!selectProvincia) return;

    selectProvincia.innerHTML = '<option value="" disabled selected>Seleccione provincia</option>';
    if (inputAltitud) inputAltitud.value = '';

    if (!idDepto) return;

    try {
        const respuesta = await fetch(`${API_URL}geografia/provincias/${idDepto}`);
        if (respuesta.ok) {
            const provincias = await respuesta.json();
            provincias.forEach(p => {
                let option = document.createElement('option');
                option.value = p.idCiudad;
                option.textContent = p.nombre;
                option.setAttribute('data-altitud', p.altitud);
                selectProvincia.appendChild(option);
            });

            // Si existe una provincia guardada en la precarga del backend, la seleccionamos automáticamente
            if (typeof provinciaIdPrecarga !== 'undefined' && provinciaIdPrecarga) {
                selectProvincia.value = provinciaIdPrecarga;
                actualizarAltitud(); 
                provinciaIdPrecarga = null; 
            }
        }
    } catch (error) {
        console.error("Error al obtener las provincias:", error);
    }
}

// Asignar la altitud promedio calculada de la provincia seleccionada
function actualizarAltitud() {
    const selectProvincia = document.getElementById('provincia');
    if (!selectProvincia) return;
    
    const optionSeleccionada = selectProvincia.options[selectProvincia.selectedIndex];
    const inputAltitud = document.getElementById('altitud');
    
    if (optionSeleccionada && optionSeleccionada.value) {
        idciudade = optionSeleccionada.value;
        const altitud = optionSeleccionada.getAttribute('data-altitud');
        if (inputAltitud) {
            inputAltitud.value = altitud || 0;
        }
    } else {
        idciudade = 0;
        if (inputAltitud) {
            inputAltitud.value = '';
        }
    }
}

// Función encargada de renderizar el botón o el mensaje según el estado booleano
function evaluarRolPaciente(esPaciente) {
    const contenedor = document.getElementById('contenedorAccionRol');
    if (!contenedor) return;

    if (esPaciente) {
        // Si es TRUE: se inyecta el mensaje indicando que ya está registrado
        contenedor.innerHTML = `
            <div style="color: #10b981; font-weight: 600; font-size: 14px; padding: 10px 14px; background-color: #ecfdf5; border-radius: 6px; border: 1px solid #a7f3d0; text-align: center;">
                ✓ Ya está registrado como paciente
            </div>`;
    } else {
        // Si es FALSE: se crea el botón y se le asocia el evento click para ejecutar Selector()
        contenedor.innerHTML = `
            <button class="btn btn-info" type="button" id="btnNuevoRol">Nuevo Rol de Paciente</button>`;
        
        document.getElementById('btnNuevoRol').addEventListener('click', Selector);
    }
}

// Acción ejecutada al presionar el botón "Nuevo Rol de Paciente" cuando verificación es false
function Selector() {
    const selectRol = document.getElementById("rol");
    if (selectRol) {
        selectRol.value = "Paciente";
    }

    const contenedorSangre = document.getElementById("contenedorTipoSangre");
    const selectSangre = document.getElementById("Tipo_Sangre");

    if (contenedorSangre) {
        contenedorSangre.style.display = "block";
    }

    if (selectSangre) {
        selectSangre.setAttribute("required", "required");
    }

    const selectEsp = document.getElementById("selectEspecialidades");
    if (selectEsp) {
        selectEsp.removeAttribute("required"); 
    }
}

async function cargarEspecialidades() {
    const selectEsp = document.getElementById('selectEspecialidades');
    if (!selectEsp) return;

    try {
        const respuesta = await fetch(`${API_URL}Especialidades`); 
        
        if (respuesta.ok) {
            const especialidades = await respuesta.json();
            
            // Limpiamos el mensaje de "Cargando..."
            selectEsp.innerHTML = '<option value="" disabled selected>Seleccione su especialidad</option>';
            
            // Recorremos el array que devuelve tu API
            especialidades.forEach(e => {
                let option = document.createElement('option');
                option.value = e.idEspecialidad; 
                option.textContent = e.nombre;   
                selectEsp.appendChild(option);
            });
        } else {
            console.error("Error al obtener las especialidades:", respuesta.status);
            selectEsp.innerHTML = '<option value="" disabled>Error al cargar especialidades</option>';
        }
    } catch (error) {
        console.error("Error en la petición de especialidades:", error);
        selectEsp.innerHTML = '<option value="" disabled>Error de conexión</option>';
    }
}
