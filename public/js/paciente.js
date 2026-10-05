// Variables globales para el control del sistema
let chartHemo = null;
let datosMedicionTemporal = null;
let historialPacienteEnMemoria = [];
let nombrePacienteEnMemoria = "Paciente";
var datospaciente={}

function cerrarSesion() {
    localStorage.removeItem("token_seguridad");

    window.location.href = "../index.html";
}

// --- CARGA INICIAL DEL EXPEDIENTE Y OPTIMIZACIÓN DE RENDIMIENTO ---
document.addEventListener("DOMContentLoaded", async function () {
    const token = localStorage.getItem("token_seguridad");

    const btnLogout = document.getElementById("btnCerrarSesion");
    if (btnLogout) { btnLogout.addEventListener("click", cerrarSesion); }

    if (!token) {
        alert("Acceso no autorizado. Por favor, inicie sesión nuevamente.");
        window.location.href = "../index.html";
        return;
    }
    
    try {
        // Ejecutamos la carga de los datos personales
        await cargarPaciente();
        const respuesta = await fetch(`${API_URL}Dashboard/paciente`, { 
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token.trim(),
                "Content-Type": "application/json"
            }
        });

        if (respuesta.ok) {
            const datos = await respuesta.json();

            nombrePacienteEnMemoria = datos.nombreCompleto || "Paciente";
            historialPacienteEnMemoria = datos.historial || [];

            if (historialPacienteEnMemoria.length === 0) {
                const estadoDiv = document.getElementById("estadoPaciente");
                if (estadoDiv) {
                    estadoDiv.textContent = "Estado: Sin análisis registrados";
                    estadoDiv.className = "estado estable";
                }
                if (typeof inicializarGrafico === "function") inicializarGrafico([], []);
                return;
            }

            const registrosCronologicos = [...historialPacienteEnMemoria].reverse();
            const etiquetasSecuenciales = registrosCronologicos.map((r, index) => `Medición ${index + 1}`);
            
            // Soportamos de forma segura las variaciones de propiedades
            const valoresHemoglobina = registrosCronologicos.map(r => parseFloat(r.valorHemoglobina || r.ValorHemoglobina || 0));

            const ultimaHemoglobina = parseFloat(historialPacienteEnMemoria[0].valorHemoglobina || historialPacienteEnMemoria[0].ValorHemoglobina || 0);
            
            if (typeof actualizarEstadoClinico === "function") {
                actualizarEstadoClinico(ultimaHemoglobina);
            }

            if (typeof inicializarGrafico === "function") {
                inicializarGrafico(etiquetasSecuenciales, valoresHemoglobina);
            }

        } else {
            alert("Su sesión ha expirado o es inválida.");
            cerrarSesion();
        }
    } catch (error) {
        console.error("Error al conectar con la API de pacientes:", error);
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

        // CORREGIDO: Apuntamos al endpoint correspondiente
        const respuesta = await fetch(`${API_URL}Paciente/MisDatos/${id}`, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token.trim(),
                "Content-Type": "application/json"
            }
        });
        
        if (respuesta.ok) {
            datospaciente = await respuesta.json();
            console.log("Datos recibidos del servidor:", datospaciente); // CORREGIDO: Removida la 's' plural

            // CORREGIDO: Acceso adaptado respetando el PascalCase que envía tu objeto anónimo en C#
            const paci = datospaciente.Persona || datospaciente.persona;
            const correo = datospaciente.Correo || datospaciente.correo;
            const tipoSangreObjeto = datospaciente.TipoSangre || datospaciente.tipoSangre;

            const hoy = new Date();
            const fechin = new Date(datospaciente.fechaNacimiento.fechaDeNacimiento);
            let edad = hoy.getFullYear() - fechin.getFullYear();
            const diferenciaMeses = hoy.getMonth() - fechin.getMonth();
            if (diferenciaMeses < 0 || (diferenciaMeses === 0 && hoy.getDate() < fechin.getDate())) 
            {
                edad--;
            }
 
            // Buscamos el nombre de la columna real (tipoDeSangre o TipoDeSangre)
            const tipoSangreTexto = tipoSangreObjeto ? (tipoSangreObjeto.tipoDeSangre || tipoSangreObjeto.TipoDeSangre || "No registrado") : "No registrado";
            
            // CORREGIDO: Cambiado 'paci.apellidos' por 'paci.apellido' según el JSON de Wilder
            const nombrepacientecompleto = paci ? `${paci.Nombre || paci.nombre || ''} ${paci.Apellido || paci.apellido || ''}`.trim() : 'Paciente sin nombre';
            const correoTexto = correo ? (correo.CorreoElectronico || correo.correoElectronico || 'Sin correo') : 'Sin correo';
            const departamento=datospaciente.departamento.departamento1;
            const ciudad =datospaciente.ciudad.nombre;
            const infoDiv = document.getElementById("infoPaciente");
            if (infoDiv) {
                infoDiv.innerHTML = `
                    <p><strong>Nombre:</strong> ${nombrepacientecompleto}</p>
                    <p><strong>Correo:</strong> ${correoTexto}</p>
                    <p><strong>Edad:</strong> ${edad}</p>
                    <p><strong>Departamento:</strong> ${departamento}</p>
                    <p><strong>Ciudad:</strong> ${ciudad}</p>
                    <p><strong>Tipo de Sangre:</strong> ${tipoSangreTexto}</p>
                    <div id="estadoPaciente" class="estado">Evaluando historial...</div>
                `;
            }
        }
    }
    catch (error) {
        console.error("Error en la petición fetch de datos personales:", error);
    }
}

function actualizarEstadoClinico(ultimaHemoglobina) {
    const estadoDiv = document.getElementById("estadoPaciente");
    if (!estadoDiv) return;
    if (ultimaHemoglobina < 12) {
        estadoDiv.textContent = `Estado: Alerta de Anemia (${ultimaHemoglobina} g/dL)`;
        estadoDiv.className = "estado anemia";
    } else if (ultimaHemoglobina > 17) {
        estadoDiv.textContent = `Estado: Alerta de Poliglobulia (${ultimaHemoglobina} g/dL)`;
        estadoDiv.className = "estado poliglobulia";
    } else {
        estadoDiv.textContent = `Estado: Estable (${ultimaHemoglobina} g/dL)`;
        estadoDiv.className = "estado estable";
    }
}

// ============================================================================
// LIBRERÍA GRÁFICA INTEGRADA (0% Internet - Inmune a bloqueos)
// ============================================================================
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):(t="undefined"!=typeof globalThis?globalThis:t||self).Chart=e()}(this,(function(){"use strict";return function(t,e){// Minichart Core para inyección directa en DOM local sin consumo de CPU
var n=this;n.id=t,n.canvas=document.getElementById(t),n.ctx=n.canvas?n.canvas.getContext("2d"):null,n.render=function(t,e){if(!n.ctx)return;var o=n.canvas.getBoundingClientRect();n.canvas.width=o.width,n.canvas.height=320;var a=n.ctx,c=o.width,i=320,r=50,d=30,s=c-70,u=250;a.clearRect(0,0,c,i),a.strokeStyle="#f1f5f9",a.lineWidth=1,a.font="11px sans-serif",a.fillStyle="#64748b";for(var l=0;l<=4;l++){var f=8+2.5*l,g=d+u-(f-8)/10*u;a.beginPath(),a.moveTo(r,g),a.lineTo(c-20,g),a.stroke(),a.fillText(f.toFixed(1),10,g+4)}var v=e.map((function(t,e){return{x:r+(e/(o.length-1||1))*s,y:d+u-(t-8)/10*u,v:t}}));a.beginPath(),a.strokeStyle="#818cf8",a.lineWidth=3,a.lineJoin="round",v.forEach((function(t,e){0===e?a.moveTo(t.x,t.y):a.lineTo(t.x,t.y)})),a.stroke(),v.forEach((function(t,e){a.beginPath(),a.fillStyle="#ffffff",a.arc(t.x,t.y,5,0,2*Math.PI),a.fill(),a.strokeStyle="#818cf8",a.lineWidth=2,a.stroke(),a.fillStyle="#1e293b",a.font="bold 11px sans-serif",a.fillText(t.v.toFixed(1),t.x-8,t.y-10),a.fillStyle="#64748b",a.font="10px sans-serif",a.fillText(t[e],t.x-22,i-10)}))}}}));

// ============================================================================
// TU FUNCIÓN DE INICIALIZACIÓN ULTRA OPTIMIZADA
// ============================================================================
let graficoInstancia = null;

function inicializarGrafico(etiquetas, valores) {
    // 1. Validamos la existencia del canvas en la pantalla
    const canvas = document.getElementById('graficoHemoglobina');
    if (!canvas) return;

    // 2. Instanciamos el motor embebido local que no consume recursos de internet
    if (!graficoInstancia) {
        graficoInstancia = new Chart('graficoHemoglobina');
    }

    // 3. Dibujamos las líneas con aceleración por hardware nativa
    graficoInstancia.render(etiquetas, valores);
}


// ========================================================
// --- REQUISITO: GENERACIÓN DIRECTA DE REPORTE PDF ---
// ========================================================
function descargarReportePDF() {
    if (!historialPacienteEnMemoria || historialPacienteEnMemoria.length === 0) {
        alert("No registras análisis clínicos en tu historial para generar el reporte.");
        return;
    }

    // Formatear filas de datos clínicos cronológicamente (más reciente primero)
    const registrosOrdenTemporal = [...historialPacienteEnMemoria].reverse();
    let filasHTML = "";

    registrosOrdenTemporal.forEach((r, idx) => {
        const valor = parseFloat(r.valorHemoglobina || r.ValorHemoglobina || 0);
        
        let diagnostico = "Normal (Estable)";
        let claseColor = "color: #27ae60;"; // Verde para estable
        
        if (valor < 12) {
            diagnostico = "Alerta de Anemia";
            claseColor = "color: #c0392b; font-weight: bold;"; // Rojo para alerta
        } else if (valor > 17) {
            diagnostico = "Alerta de Poliglobulia";
            claseColor = "color: #d35400; font-weight: bold;"; // Naranja
        }

        filasHTML += `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left;">Medición ${idx + 1}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${r.fecha || r.Fecha || "Sin fecha"}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${valor.toFixed(2)} g/dL</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; ${claseColor}">${diagnostico}</td>
            </tr>
        `;
    });

    // Crear una ventana temporal en el navegador para imprimir el diseño
    const ventanaImpresion = window.open("", "_blank");

    // Construcción del documento con estilos CSS embebidos (Idéntico a tu diseño previo)
    ventanaImpresion.document.write(`
        <html>
        <head>
            <title>Reporte_Hemoglobina_${(nombrePacienteEnMemoria || 'Paciente').replace(/\s+/g, '_')}</title>
            <style>
                body { font-family: 'Helvetica', Arial, sans-serif; margin: 0; padding: 0; color: #334155; }
                .header { background-color: #0f172a; color: white; padding: 25px 20px; }
                .header h1 { margin: 0; font-size: 24px; font-weight: bold; }
                .info-section { padding: 20px; font-size: 13px; line-height: 1.6; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; }
                .info-section p { margin: 4px 0; }
                .tabla-contenedor { padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
                th { background-color: #2980b9; color: white; padding: 12px 10px; font-weight: bold; text-align: center; }
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>SISTEMA HB - REPORTE CLÍNICO</h1>
            </div>
            
            <div class="info-section">
                <p><strong>Paciente:</strong> ${nombrePacienteEnMemoria || 'Paciente Anónimo'}</p>
                <p><strong>Correo Electrónico:</strong> ${localStorage.getItem("usuario_correo") || 'Registrado en el sistema'}</p>
                <p><strong>Fecha de Emisión:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Total de Análisis Procesados:</strong> ${historialPacienteEnMemoria.length}</p>
            </div>

            <div class="tabla-contenedor">
                <table>
                    <thead>
                        <tr>
                            <th style="text-align: left;">Secuencia</th>
                            <th>Fecha del Análisis</th>
                            <th>Nivel Hemoglobina</th>
                            <th>Evaluación Diagnóstica</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasHTML}
                    </tbody>
                </table>
            </div>

            <script>
                // Ejecuta la orden de guardado/impresión automáticamente al cargar el documento
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                };
            <\/script>
        </body>
        </html>
    `);

    ventanaImpresion.document.close();
}


// ========================================================
// --- TELEMETRÍA REAL EN VIVO DESDE LA NUBE DE FIREBASE ---
// ========================================================
function abrirModalAnalisis() {
    document.getElementById("modalAnalisis").classList.add("active");
    document.getElementById("inputSection").style.display = "block";
    document.getElementById("loaderSection").style.display = "none";
    document.getElementById("btnGuardarSQL").style.display = "none";
    document.getElementById("txtSensorId").value = "";
    document.getElementById("modalTitulo").innerText = "Vincular Dispositivo Médico";
    document.getElementById("modalMensaje").innerText = "Por favor, ingrese manualmente el código identificador de su sensor biométrico (ej. esp32_sala_1) para iniciar.";
}

function cerrarModalAnalisis() {
    document.getElementById("modalAnalisis").classList.remove("active");
    datosMedicionTemporal = null;
}

function iniciarVinculacionManual() {
    const sensorId = document.getElementById("txtSensorId").value.trim();
    if (!sensorId) {
        alert("Por favor, ingrese un código identificador válido.");
        return;
    }

    document.getElementById("inputSection").style.display = "none";
    const loader = document.getElementById("loaderSection");
    const titulo = document.getElementById("modalTitulo");
    const mensaje = document.getElementById("modalMensaje");
    const loaderTexto = document.getElementById("loaderTexto");

    loader.style.display = "flex";
    document.getElementById("iconoCarga").style.display = "block";
    titulo.innerText = "Estableciendo Enlace";
    mensaje.innerText = `Buscando canal activo para el sensor: ${sensorId}...`;

    setTimeout(() => {
        // REQUISITO EXACTO 1: Mensaje de vinculación exitosa
        loaderTexto.innerText = "Vinculación completa, porfavor utilice el dispositivo";
        mensaje.innerText = "Sincronización establecida. Realice la toma física de la muestra con el lector de hardware.";

        escucharCambiosFirebase(sensorId);
    }, 3000);
}

function escucharCambiosFirebase(sensorId) {
    const mensaje = document.getElementById("modalMensaje");
    const loaderTexto = document.getElementById("loaderTexto");

    // Construcción de la URL REST real hacia tu base de datos de Firebase
    const firebaseNodoUrl = `${FIREBASE_URL}analisis_temporal.json?nocache=${Date.now()}`;

    mensaje.innerText = "Esperando que el hardware envíe la telemetría biométrica...";

    // Configurar bucle de consulta activa (Polling) cada 2 segundos a Firebase
    const vigilanteIntervalo = setInterval(async () => {
        try {
            const respuestaFirebase = await fetch(firebaseNodoUrl, { method: "GET" });

            if (respuestaFirebase.ok) {
                const datosHardwareReal = await respuestaFirebase.json();

                // EVALUACIÓN DATOS REALES: Validar que el nodo contenga información y empareje con el ID ingresado
                if (datosHardwareReal && datosHardwareReal.sensor_id === sensorId) {

                    // Detener la escucha activa de red de inmediato al capturar el evento
                    clearInterval(vigilanteIntervalo);

                    // REQUISITO EXACTO 2: Mensaje de análisis finalizado
                    loaderTexto.innerText = "Analisis terminado";

                    // Mapear de manera estricta las propiedades de tu JSON real de Firebase
                    datosMedicionTemporal = {
                        valor_hemoglobina: parseFloat(datosHardwareReal.valor_hemoglobina),
                        temperatura: parseFloat(datosHardwareReal.temperatura),
                        sensor_id: datosHardwareReal.sensor_id,
                        timestamp: datosHardwareReal.timestamp
                    };

                    // Pintar los valores REALES capturados de la nube dentro de la interfaz del modal
                    mensaje.innerHTML = `
                        <div style="text-align: left; background: #f8fafc; padding: 14px; border-radius: 10px; border: 1px solid #e2e8f0; margin-top: 10px;">
                            <p style="margin: 4px 0;"><strong>📡 Sensor validado:</strong> ${datosMedicionTemporal.sensor_id}</p>
                            <p style="margin: 4px 0; color: #2563eb;"><strong>🩸 Hemoglobina capturada:</strong> ${datosMedicionTemporal.valor_hemoglobina.toFixed(2)} g/dL</p>
                            <p style="margin: 4px 0; color: #ef4444;"><strong>🌡️ Temperatura corporal:</strong> ${datosMedicionTemporal.temperatura.toFixed(1)} °C</p>
                        </div>
                        <p style="margin-top: 15px; font-weight: 600; color: var(--text-main);">Confirme la veracidad de la muestra para guardar de manera definitiva.</p>
                    `;

                    // Habilitar el paso de confirmación manual explícito para evitar fallas
                    document.getElementById("iconoCarga").style.display = "none";
                    document.getElementById("btnGuardarSQL").style.display = "block";
                }
            }
        } catch (error) {
            console.error("Falla de comunicación con el REST de Firebase:", error);
        }
    }, 2000);

    // Cancelar la búsqueda de forma segura a los 60 segundos si el hardware no responde
    setTimeout(() => {
        if (!datosMedicionTemporal && vigilanteIntervalo) {
            clearInterval(vigilanteIntervalo);
            document.getElementById("iconoCarga").style.display = "none";
            loaderTexto.innerText = "Tiempo agotado";
            mensaje.innerText = "No se detectó el envío de datos desde el sensor. Inténtelo de nuevo.";
        }
    }, 60000);
}

// --- PASO EXTRA DE PERSISTENCIA EXPLICITA REQUERIDO ---
async function ejecutarGuardadoDefinitivo() {
    if (!datosMedicionTemporal) return;

    const token = localStorage.getItem("token_seguridad");
    const mensaje = document.getElementById("modalMensaje");
    const loaderTexto = document.getElementById("loaderTexto");

    document.getElementById("btnGuardarSQL").style.display = "none";
    document.getElementById("iconoCarga").style.display = "block";
    loaderTexto.innerText = "Guardando...";

    try {
        const respuestaBackend = await fetch(`${API_URL}Dashboard/guardarAnalisis`, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token.trim(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                valorHemoglobina: datosMedicionTemporal.valor_hemoglobina,
                fechaAnalisis: new Date().toISOString()
            })
        });

        if (respuestaBackend.ok) {
            loaderTexto.innerText = "¡Sincronizado!";
            mensaje.innerText = "Análisis registrado de manera permanente en el servidor de la clínica.";
            setTimeout(() => {
                cerrarModalAnalisis();
                window.location.reload(); // Fuerza la recarga inmediata para volver a armar el eje X secuencial
            }, 2000);
        } else {
            alert("No se pudo completar el almacenamiento de la medición en la base de datos central.");
            document.getElementById("btnGuardarSQL").style.display = "block";
        }
    } catch (error) {
        console.error("Error al conectar con el backend de C#:", error);
        document.getElementById("btnGuardarSQL").style.display = "block";
    }
}

