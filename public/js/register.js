var idciudade = 0;

// Establecer fecha máxima permitida en el input de fecha (hoy) para evitar fechas futuras
document.addEventListener("DOMContentLoaded", async () => {
    const hoy = new Date().toISOString().split("T")[0];
    document.getElementById("fecha_nacimiento").setAttribute("max", hoy);

    const selectDepto = document.getElementById('departamento');
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
});

// 2. Cargar Provincias/Ciudades dinámicamente filtradas por el departamento
async function cargarProvincias() {
    const idDepto = document.getElementById('departamento').value;
    const selectProvincia = document.getElementById('provincia');
    const inputAltitud = document.getElementById('altitud');

    selectProvincia.innerHTML = '<option value="" disabled selected>Seleccione provincia</option>';
    inputAltitud.value = '';

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
        }
    } catch (error) {
        console.error("Error al obtener las provincias:", error);
    }
}

// 3. Evaluar Rol de manera dinámica
async function Selector() {
    const rolSeleccionado = document.getElementById("rol").value;
    const contenedorEsp = document.getElementById("contenedorEspecialidad");
    const selectEsp = document.getElementById("especialidad");
    const contenedorSangre = document.getElementById("contenedorTipoSangre");
    const selectSangre = document.getElementById("Tipo_Sangre");

    contenedorEsp.style.display = "none";
    selectEsp.removeAttribute("required");
    selectEsp.innerHTML = '<option value="" disabled selected>Seleccione especialidad</option>';

    contenedorSangre.style.display = "none";
    selectSangre.removeAttribute("required");
    selectSangre.value = "";

    if (rolSeleccionado === "Medico") {
        contenedorEsp.style.display = "block";
        selectEsp.setAttribute("required", "required");

        try {
            const respuestaesp = await fetch(`${API_URL}Especialidades`);
            if (respuestaesp.ok) {
                const especialidades = await respuestaesp.json();
                especialidades.forEach(e => {
                    let option = document.createElement('option');
                    option.value = e.idEspecialidad;
                    option.textContent = e.nombre;
                    selectEsp.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Error al cargar especialidades:", error);
        }
    } else if (rolSeleccionado === "Paciente") {
        contenedorSangre.style.display = "block";
        selectSangre.setAttribute("required", "required");
    }
}

// 4. Asignar la altitud promedio calculada de la provincia seleccionada
function actualizarAltitud() {
    const selectProvincia = document.getElementById('provincia');
    const optionSeleccionada = selectProvincia.options[selectProvincia.selectedIndex];
    const inputAltitud = document.getElementById('altitud');
    idciudade = optionSeleccionada.value;
    if (optionSeleccionada && optionSeleccionada.value) {
        const altitud = optionSeleccionada.getAttribute('data-altitud');
        inputAltitud.value = altitud || 0;
    } else {
        inputAltitud.value = '';
    }
}

// 5. Envío estructurado y validado hacia la API
document.getElementById('formRegistro').addEventListener('submit', async function (e) {
    e.preventDefault();

    // Recolección de valores
    const nombre = document.getElementById('nombre').value.trim();
    const apellidoPaterno = document.getElementById('apellido_paterno').value.trim();
    const apellidoMaterno = document.getElementById('apellido_materno').value.trim();
    const inputFecha = document.getElementById('fecha_nacimiento').value;
    const selectDepto = document.getElementById('departamento').value;
    const selectProv = document.getElementById('provincia').value;
    const altitudVal = parseFloat(document.getElementById('altitud').value);
    const correo = document.getElementById('correo').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm_password').value;
    const rolSeleccionado = document.getElementById('rol').value;

    // EXPRESIONES REGULARES DE VALIDACIÓN
    const soloTextoRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;
    const correoRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,16}$/;

    // --- VALIDACIONES ---

    if (!nombre) {
        alert("El campo Nombre(s) es obligatorio.");
        return;
    }
    if (nombre.length > 30) {
        alert("El Nombre no debe exceder los 30 caracteres.");
        return;
    }
    if (!soloTextoRegex.test(nombre)) {
        alert("El Nombre solo debe aceptar caracteres de texto (sin números ni símbolos especiales).");
        return;
    }

    if (apellidoPaterno !== "") {
        if (apellidoPaterno.length > 30) {
            alert("El Apellido Paterno no debe exceder los 30 caracteres.");
            return;
        }
        if (!soloTextoRegex.test(apellidoPaterno)) {
            alert("El Apellido Paterno solo debe aceptar caracteres de texto.");
            return;
        }
    }

    if (apellidoMaterno !== "") {
        if (apellidoMaterno.length > 30) {
            alert("El Apellido Materno no debe exceder los 30 caracteres.");
            return;
        }
        if (!soloTextoRegex.test(apellidoMaterno)) {
            alert("El Apellido Materno solo debe aceptar caracteres de texto.");
            return;
        }
    }

    if (!inputFecha) {
        alert("Por favor, ingrese una fecha de nacimiento válida.");
        return;
    }
    const fechaNacimientoDate = new Date(inputFecha);
    const hoyDate = new Date();
    hoyDate.setHours(0, 0, 0, 0);
    if (fechaNacimientoDate > hoyDate) {
        alert("La fecha de nacimiento no puede ser una fecha futura.");
        return;
    }

    if (!selectDepto) {
        alert("Debe seleccionar un Departamento.");
        return;
    }
    if (!selectProv) {
        alert("Debe seleccionar una Ciudad/Provincia.");
        return;
    }

    if (isNaN(altitudVal) || altitudVal < 0) {
        alert("La altitud no puede ser un valor negativo.");
        return;
    }

    if (!correo) {
        alert("El correo electrónico es obligatorio.");
        return;
    }
    if (correo.length > 30) {
        alert("El correo electrónico no debe exceder los 30 caracteres.");
        return;
    }
    if (!correoRegex.test(correo)) {
        alert("Por favor, ingrese un formato de correo electrónico válido (ejemplo@ej.com).");
        return;
    }

    if (!passwordRegex.test(password)) {
        alert("La contraseña debe tener entre 8 y 16 caracteres, incluir letras minúsculas, mayúsculas, números y al menos un carácter especial.");
        return;
    }

    if (password !== confirmPassword) {
        alert("Las contraseñas no coinciden. Por favor, verifíquelas.");
        return;
    }

    // Activamos la pantalla de carga antes de la petición fetch
    mostrarLoader("Registrando usuario...");
    await new Promise(resolve => setTimeout(resolve, 50));

    const selectDeptoElement = document.getElementById('departamento');
    const selectProvElement = document.getElementById('provincia');
    const selectEspElement = document.getElementById('especialidad');

    const departamentoTexto = selectDeptoElement && selectDeptoElement.selectedIndex !== -1 ? selectDeptoElement.options[selectDeptoElement.selectedIndex].text : "";
    const departamentoId = selectDeptoElement && selectDeptoElement.value ? parseInt(selectDeptoElement.value) : 0;
    const provinciaTexto = selectProvElement && selectProvElement.selectedIndex !== -1 ? selectProvElement.options[selectProvElement.selectedIndex].text : "";

    const dataUsuario = {
        nombre: nombre,
        apellidoPaterno: apellidoPaterno,
        apellidoMaterno: apellidoMaterno,
        genero: document.querySelector('input[name="genero"]:checked')?.value || "",
        fechaNacimiento: inputFecha,
        departamento: departamentoTexto,
        idDepartamento: departamentoId,
        provincia: provinciaTexto,
        altitud: altitudVal,
        correo: correo,
        password: password,
        rol: rolSeleccionado,
        tipo_sangre: rolSeleccionado === "Paciente" ? document.getElementById("Tipo_Sangre").value : null,
        idEspecialidad: rolSeleccionado === "Medico" ? parseInt(selectEspElement.value) : 0
    };

    try {
        const respuesta = await fetch(`${API_URL}Registro/usuario`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(dataUsuario)
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            mostrarLoader("¡Registro completado con éxito!");
            setTimeout(() => {
                ocultarLoader();
                alert(resultado.mensaje || "Registro completado con éxito.");
                window.location.href = "../index.html";
            }, 800);
        } else {
            ocultarLoader();
            console.error("Errores detallados enviados por el servidor .NET:", resultado);
            alert(resultado.mensaje || "Ocurrió un inconveniente al registrar. Revisa la consola para más detalles.");
        }
    } catch (error) {
        ocultarLoader();
        alert("No se pudo conectar con el servidor de la API.");
        console.error("Error en la petición Fetch:", error);
    }
});