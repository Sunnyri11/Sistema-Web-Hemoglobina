var datosmedicos = {};
document.addEventListener("DOMContentLoaded", async () => {
    const selectDepto = document.getElementById('departamento');
    
    // Configurar listeners para los cambios manuales del usuario
    selectDepto.addEventListener('change', () => cargarProvincias());
    
    const selectProvincia = document.getElementById('provincia');
    if (selectProvincia) {
        selectProvincia.addEventListener('change', actualizarAltitud);
    }

    try {
        // Primero descargamos todos los departamentos base
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

            // CORRECCIÓN: Ejecutamos la carga del paciente SOLO cuando los departamentos ya existen en el DOM
            await cargarPaciente();
        }
    } catch (error) {
        console.error("Error al cargar la configuración inicial:", error);
    }
});


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
            document.getElementById("nombre").value = paci.nombre;

            const palabrasApellido = (paci.apellido || '').trim().split(' ');
            const apellidoPaterno = palabrasApellido[0] || '';
            const apellidoMaterno = palabrasApellido.slice(1).join(' ') || '';
            
            document.getElementById("paterno").value = apellidoPaterno;
            document.getElementById("materno").value = apellidoMaterno;

            const departamento = datospaciente.departamento;
            const ciudad = datospaciente.ciudad;
            if (departamento && departamento.idDepartamento) {

                document.getElementById("departamento").value = departamento.idDepartamento;
                
                provinciaIdPrecarga = ciudad.idCiudad; 
                
                await cargarProvincias(); 
            }
            const tiposangre= datospaciente.tipoSangre;
            console.log(tiposangre);
            document.getElementById("Tipo_Sangre").value=tiposangre.tipoDeSangre;
            const generoValor = Number(paci.idGenero);
            if (generoValor === 1) {
                document.getElementById("genero_masculino").checked = true;
            } else if (generoValor === 2) {
                document.getElementById("genero_femenino").checked = true;
            }

            const fechaRaw = datospaciente.fechaNacimiento?.fechaDeNacimiento;
            if (fechaRaw) {
                const fechaFormateada = fechaRaw.split('T')[0];
                document.getElementById("fecha_nacimiento").value = fechaFormateada;
            }

            var correo = datospaciente.correo.correoElectronico;
            document.getElementById("correo").value = correo;
        } else {
            console.error("Error en la respuesta del servidor:", respuesta.status);
        }
    }
    catch (error) {
        console.error("Error en la petición fetch:", error);
    }
}