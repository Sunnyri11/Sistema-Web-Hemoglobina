var datospaciente = {};
let provinciaIdPrecarga = null;

// Caché global en memoria
let cacheDepartamentos = [];
let cacheProvinciasPorDepto = {};

// 1. Cargar y cachear todos los departamentos
async function cargarDepartamentos() {
    const selectDepto = document.getElementById('departamento');
    if (!selectDepto) return;

    try {
        if (cacheDepartamentos.length === 0) {
            const respuesta = await fetch(`${API_URL}geografia/departamentos`);
            if (respuesta.ok) {
                cacheDepartamentos = await respuesta.json();
            }
        }

        selectDepto.innerHTML = '<option value="" disabled selected>Seleccione departamento</option>';
        cacheDepartamentos.forEach(d => {
            let option = document.createElement('option');
            option.value = d.idDepartamento;
            option.textContent = d.nombre;
            selectDepto.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar departamentos:", error);
    }
}

// 2. Cargar provincias usando caché para evitar llamadas duplicadas
async function cargarProvincias(deptoId = null) {
    const idDepto = deptoId || document.getElementById('departamento').value;
    const selectProvincia = document.getElementById('provincia');
    const inputAltitud = document.getElementById('altitud');

    if (!idDepto) return;

    if (selectProvincia) {
        selectProvincia.innerHTML = '<option value="" disabled selected>Seleccione provincia/ciudad</option>';
    }
    if (inputAltitud && !provinciaIdPrecarga) inputAltitud.value = '';

    try {
        if (!cacheProvinciasPorDepto[idDepto]) {
            const respuesta = await fetch(`${API_URL}geografia/provincias/${idDepto}`);
            if (respuesta.ok) {
                cacheProvinciasPorDepto[idDepto] = await respuesta.json();
            } else {
                return;
            }
        }

        const provincias = cacheProvinciasPorDepto[idDepto];

        provincias.forEach(p => {
            let option = document.createElement('option');
            option.value = p.idCiudad;
            option.textContent = p.nombre;
            option.setAttribute('data-altitud', p.altitud);
            selectProvincia.appendChild(option);
        });

        // Si hay una provincia precargada por el perfil del paciente, la seleccionamos
        if (provinciaIdPrecarga) {
            selectProvincia.value = provinciaIdPrecarga;
            provinciaIdPrecarga = null;
            actualizarAltitud();
        }
    } catch (error) {
        console.error("Error al obtener las provincias:", error);
    }
}

function actualizarAltitud() {
    const selectProvincia = document.getElementById('provincia');
    if (!selectProvincia) return;
    
    const optionSeleccionada = selectProvincia.options[selectProvincia.selectedIndex];
    const inputAltitud = document.getElementById('altitud');

    if (optionSeleccionada && optionSeleccionada.value) {
        const altitud = optionSeleccionada.getAttribute('data-altitud');
        if (inputAltitud) inputAltitud.value = altitud || 0;
    } else {
        if (inputAltitud) inputAltitud.value = '';
    }
}

async function cargarPaciente() {
    try {
        const token = localStorage.getItem("token_seguridad");
        const id = localStorage.getItem("usuario_id");
        if (!token || !id) {
            console.error("No se encontró el token o el ID del usuario en el almacenamiento local.");
            return;
        }

        const respuesta = await fetch(`${API_URL}Paciente/MisDatos/${id}`, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token.trim(),
                "Content-Type": "application/json"
            }
        });

        if (respuesta.ok) {
            datospaciente = await respuesta.json();
            console.log("Datos recibidos del servidor:", datospaciente);

            const paci = datospaciente.persona;
            if (paci) {
                document.getElementById("nombre").value = paci.nombre || "";
                document.getElementById("paterno").value = paci.paterno || "";
                document.getElementById("materno").value = paci.materno || "";

                const generoValor = Number(paci.idGenero);
                if (generoValor === 1) {
                    const radioM = document.getElementById("genero_masculino");
                    if (radioM) radioM.checked = true;
                } else if (generoValor === 2) {
                    const radioF = document.getElementById("genero_femenino");
                    if (radioF) radioF.checked = true;
                }
            }

            // Mapeo corregido según la estructura JSON que te devuelve la API (datospaciente.departamento y datospaciente.ciudad)
            const deptoObj = datospaciente.departamento;
            const ciudadObj = datospaciente.ciudad;
            
            if (deptoObj && deptoObj.idDepartamento) {
                // 1. Asignamos el valor exacto del departamento en el select
                document.getElementById("departamento").value = deptoObj.idDepartamento;

                if (ciudadObj && ciudadObj.idCiudad) {
                    provinciaIdPrecarga = ciudadObj.idCiudad;
                }

                // 2. Cargamos las provincias de este departamento para poblar el select de ciudades y marcar la ciudad del paciente
                await cargarProvincias(deptoObj.idDepartamento);
            }

            const tiposangre = datospaciente.tipoSangre;
            if (tiposangre && tiposangre.tipoDeSangre) {
                const selectSangre = document.getElementById("Tipo_Sangre");
                if (selectSangre) selectSangre.value = tiposangre.tipoDeSangre;
            }

            const fechaRaw = datospaciente.fechaNacimiento?.fechaDeNacimiento;
            if (fechaRaw) {
                const fechaFormateada = fechaRaw.split('T')[0];
                const inputFecha = document.getElementById("fecha_nacimiento");
                if (inputFecha) inputFecha.value = fechaFormateada;
            }

            const correo = datospaciente.correo?.correoElectronico;
            if (correo) {
                const inputCorreo = document.getElementById("correo");
                if (inputCorreo) inputCorreo.value = correo;
            }
        } else {
            console.error("Error en la respuesta del servidor:", respuesta.status);
        }
    } catch (error) {
        console.error("Error en la petición fetch:", error);
    }
}

function togglePassword(fieldId, iconId) {
    const inputField = document.getElementById(fieldId);
    const iconElement = document.getElementById(iconId);
    if (!inputField || !iconElement) return;

    if (inputField.type === "password") {
        inputField.type = "text";
        iconElement.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        `;
    } else {
        inputField.type = "password";
        iconElement.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        `;
    }
}

// 3. Inicialización optimizada
document.addEventListener("DOMContentLoaded", async () => {
    const selectDepto = document.getElementById('departamento');

    if (selectDepto) {
        // Limpiamos o dejamos que el listener maneje los cambios manuales posteriores del usuario
        selectDepto.addEventListener('change', () => cargarProvincias());
    }

    // 1. Primero cargamos todos los departamentos disponibles
    await cargarDepartamentos();

    // 2. Después cargamos los datos del paciente (lo que marcará su departamento y ciudad de forma correcta)
    await cargarPaciente();
});