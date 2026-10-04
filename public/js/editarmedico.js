var datosmedicos = {};
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
            console.log(med);
            document.getElementById("nombre").value = med.nombre;

            const palabrasApellido = (med.apellido || '').trim().split(' ');

            
            const apellidoPaterno = palabrasApellido[0] || '';


            const apellidoMaterno = palabrasApellido.slice(1).join(' ') || '';

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
            // Opcional: ver el texto exacto del error que configuramos en C#
            const errorTexto = await respuesta.text();
            console.error("Detalle del error del servidor:", errorTexto);
        }
    }
    catch (error) {
        console.error("Error en la petición fetch:", error);
    }
}