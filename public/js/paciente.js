var arrayhistorial = []; 
let chartHemo = null;
let datosMedicionTemporal = null;
let historialPacienteEnMemoria = [];
let nombrePacienteEnMemoria = "Paciente";
var datospaciente = {};
let graficoInstancia = null; 


// Instancias independientes para los dos lienzos gráficos
let graficoHemoInstancia = null;
let graficoTempInstancia = null;


function MiniChartSingleLine(canvasId, minVal, maxVal, color, esTemp) {
    var n = this;
    n.canvas = document.getElementById(canvasId);
    n.ctx = n.canvas ? n.canvas.getContext("2d") : null;

    n.render = function(etiquetas, datos) {
        if (!n.ctx || !n.canvas || datos.length === 0) return;
        var o = n.canvas.getBoundingClientRect();
        n.canvas.width = o.width;
        n.canvas.height = 240; 
        
        var a = n.ctx, c = o.width, i = 240;
        var r = 50, d = 30, s = c - 90, u = 150;

        a.clearRect(0, 0, c, i);

        // --- Rejilla horizontal y Escala Eje Y ---
        a.strokeStyle = "#f1f5f9";
        a.lineWidth = 1;
        a.font = "11px sans-serif";
        
        var rango = maxVal - minVal;
        for (var l = 0; l <= 4; l++) {
            var f = minVal + (rango / 4) * l;
            var g = d + u - (l / 4) * u;
            a.beginPath();
            a.moveTo(r, g);
            a.lineTo(c - 40, g);
            a.stroke();
            
            a.fillStyle = "#64748b";
            a.fillText(f.toFixed(1), 10, g + 4);
        }

        var totalPuntos = datos.length;
        var puntos = datos.map(function(val, idx) {
            var posX = r + (totalPuntos > 1 ? (idx / (totalPuntos - 1)) * s : s / 2);
            var posY = d + u - ((val - minVal) / rango) * u;
            return { x: posX, y: posY, v: val };
        });

        // Dibujar Línea
        a.beginPath();
        a.strokeStyle = color;
        a.lineWidth = 3;
        a.lineJoin = "round";
        puntos.forEach(function(p, idx) {
            if (idx === 0) a.moveTo(p.x, p.y);
            else a.lineTo(p.x, p.y);
        });
        a.stroke();

        // Dibujar Nodos y Valores Numéricos
        puntos.forEach(function(p) {
            a.beginPath();
            a.fillStyle = "#ffffff";
            a.arc(p.x, p.y, 4, 0, 2 * Math.PI);
            a.fill();
            a.strokeStyle = color;
            a.lineWidth = 2;
            a.stroke();

            a.fillStyle = "#1e293b";
            a.font = "bold 10px sans-serif";
            a.fillText(p.v.toFixed(1) + (esTemp ? "°" : ""), p.x - 10, p.y - 10);
        });

        // Eje X - Rótulos de Fechas
        a.fillStyle = "#64748b";
        a.font = "10px sans-serif";
        etiquetas.forEach(function(fechaStr, idx) {
            var p = puntos[idx];
            if (p) {
                a.save();
                a.translate(p.x, i - 15);
                a.rotate(-0.15); 
                a.fillText(fechaStr, -20, 10);
                a.restore();
            }
        });
    };
}

// ============================================================================
// 3. INICIALIZADOR DE GRÁFICOS (REESCRITO SIN REFERENCIAS ADVERSAS)
// ============================================================================
function inicializarGrafico(etiquetas, valoresHemo, valoresTemp) {
    // 1. Instanciar y renderizar el gráfico independiente de Hemoglobina
    if (!graficoHemoInstancia) {
        graficoHemoInstancia = new MiniChartSingleLine('graficoHemoglobina', 8, 18, "#818cf8", false);
    }
    graficoHemoInstancia.render(etiquetas, valoresHemo);

    // 2. Instanciar y renderizar el gráfico independiente de Temperatura
    if (!graficoTempInstancia) {
        graficoTempInstancia = new MiniChartSingleLine('graficoTemperatura', 35, 41, "#f97316", true);
    }
    graficoTempInstancia.render(etiquetas, valoresTemp);
}

function procesarFiltroCronologico(tipoFiltro) {
    if (!arrayhistorial || arrayhistorial.length === 0) {
        inicializarGrafico([], [], []);
        return;
    }

    const ahora = new Date();
    
    // 1. Filtrado de muestras según la fecha actual
    const registrosFiltrados = arrayhistorial.filter(registro => {
        const fStr = registro.fecha || registro.Fecha;
        if (!fStr) return true; // Si no hay fecha, no lo descartamos por defecto
        
        const fechaRegistro = new Date(fStr);
        const diferenciaTiempo = ahora - fechaRegistro;
        const diferenciaDias = diferenciaTiempo / (1000 * 60 * 60 * 24);

        switch (tipoFiltro) {
            case 'dias':
                return diferenciaDias <= 1; // Últimas 24 horas
            case 'semanas':
                return diferenciaDias <= 7; // Últimos 7 días
            case 'meses':
                return diferenciaDias <= 30; // Últimos 30 días
            case 'anos':
                return diferenciaDias <= 365; // Último año
            default:
                return true; // Mostrar todos
        }
    });

    // 2. Ordenar cronológicamente (Del más antiguo al más reciente)
    const registrosOrdenados = registrosFiltrados.sort((a, b) => a.idNivel - b.idNivel);

    // 3. Mapear strings limpios para los ejes X e Y
    const etiquetasFechas = registrosOrdenados.map(r => {
        const fStr = r.fecha || r.Fecha;
        if (!fStr) return "Reg. " + r.idNivel;
        const f = new Date(fStr);
        // Retorna formato corto legible "DD/MM" para que entren bien en horizontal
        return `${f.getDate()}/${f.getMonth() + 1}`;
    });

    const valoresHemo = registrosOrdenados.map(r => parseFloat(r.valorHemoglobina || 0));
    const valoresTemp = registrosOrdenados.map(r => parseFloat(r.temperatura || 0));

    // 4. Actualizar de forma limpia ambos gráficos independientes
    inicializarGrafico(etiquetasFechas, valoresHemo, valoresTemp);
}

// Vinculación definitiva y forzada a la ventana global de ejecución
window.aplicarFiltroTiempo = function (tipoFiltro) {
    procesarFiltroCronologico(tipoFiltro);
};




function cerrarSesion() {
    localStorage.removeItem("token_seguridad");
    window.location.href = "../index.html";
}

document.addEventListener("DOMContentLoaded", async function () {
    const token = localStorage.getItem("token_seguridad");
    const btnLogout = document.getElementById("btnCerrarSesion");
    if (btnLogout) { btnLogout.addEventListener("click", cerrarSesion); }

    // Validación estricta de seguridad en la sesión
    if (!token) {
        alert("Acceso no autorizado. Por favor, inicie sesión nuevamente.");
        window.location.href = "../index.html";
        return;
    }
    
    try {
        // Carga primaria de expediente personal
        await cargarPaciente();
        
        // Peticiones paralelas al servidor central
        const respuesta = await fetch(`${API_URL}Dashboard/paciente`, { 
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token.trim(),
                "Content-Type": "application/json"
            }
        });
        
        const id = localStorage.getItem("usuario_id");
        const respuestahistorial = await fetch(`${API_URL}Paciente/mihistorial/${id}`, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + token.trim(),
                "Content-Type": "application/json"
            }
        });

        // Almacenamos el historial completo unificado devuelto por tu endpoint
        if (respuestahistorial.ok) {
            const historialhemo = await respuestahistorial.json();
            arrayhistorial = historialhemo.historial || [];
        }

        if (respuesta.ok) {
            const datos = await respuesta.json();
            nombrePacienteEnMemoria = datos.nombreCompleto || "Paciente";
            historialPacienteEnMemoria = datos.historial || [];

            // Validación por si el expediente clínico está vacío
            if (arrayhistorial.length === 0) {
                const estadoDiv = document.getElementById("estadoPaciente");
                if (estadoDiv) {
                    estadoDiv.textContent = "Estado: Sin análisis registrados";
                    estadoDiv.className = "estado estable";
                }
                inicializarGrafico([], [], []);
                return;
            }

            // 📈 Disparador inicial: Renderiza ambos gráficos con la vista 'todos'
            aplicarFiltroTiempo('todos');

            // Extracción de las últimas métricas para la tarjeta informativa superior
            const ultimoRegistro = arrayhistorial[arrayhistorial.length - 1] || {};
            const ultimaHemoglobina = parseFloat(ultimoRegistro.valorHemoglobina || 0);
            const ultimaTemp = ultimoRegistro.temperatura || "S/D";
            
            // =========================================================================
            // 🧠 INTEGRACIÓN MÓDULO ANALÍTICO EVOLUTIVO DE WALLE-HB
            // =========================================================================
            const iaNode = datos.analisisIA || datos.analisisia;
            
            if (iaNode) {
                const estadoDiv = document.getElementById("estadoPaciente");
                if (estadoDiv) {
                    const stringEstado = Array.isArray(iaNode.estado) ? iaNode.estado[0] : iaNode.estado;
                    estadoDiv.innerHTML = `ESTADO: ${stringEstado.toUpperCase()} (${ultimaHemoglobina} G/DL)<br>Temperatura: ${ultimaTemp}ºC`;

                    // Asignación de estilos dinámicos CSS según el dictamen médico
                    if (stringEstado === "Anemia") {
                        estadoDiv.className = "estado anemia";
                    } else if (stringEstado === "Poliglobulia") {
                        estadoDiv.className = "estado poliglobulia";
                    } else {
                        estadoDiv.className = "estado estable";
                    }
                }

                // Renderizado adaptativo de la cadena de alertas del modelo .pkl
                const alertaTextoDiv = document.getElementById("textoAlertaWalleHB");
                const divContenedorIa = document.getElementById("alertasWalleHB");
                
                if (alertaTextoDiv && iaNode.alertas) {
                    let mensajePuro = "";
                    if (Array.isArray(iaNode.alertas) && iaNode.alertas.length > 0) {
                        mensajePuro = iaNode.alertas[0];
                    } else if (typeof iaNode.alertas === "string") {
                        mensajePuro = iaNode.alertas;
                    }

                    if (mensajePuro.length > 0) {
                        const mensajeFormateado = mensajePuro.replace(/\n/g, "<br>");
                        alertaTextoDiv.innerHTML = `<strong>Obtenido del historial de mediciones:</strong><br><br>${mensajeFormateado}`;
                        if (divContenedorIa) divContenedorIa.style.display = "block";
                    }
                }

                // Listado secuencial de recomendaciones clínicas sugeridas
                const listaUl = document.getElementById("listaRecomendacionesWalleHB");
                if (listaUl && iaNode.recomendaciones) {
                    listaUl.innerHTML = ""; 
                    iaNode.recomendaciones.forEach(rec => {
                        const li = document.createElement("li");
                        li.textContent = rec;
                        li.className = "item-recommendacion-ia"; 
                        listaUl.appendChild(li);
                    });
                }
            } else {
                // Fallback preventivo si el nodo inteligente falla temporalmente
                if (typeof actualizarEstadoClinico === "function") {
                    actualizarEstadoClinico(ultimaHemoglobina);
                }
            }

        } else {
            alert("Su sesión ha expirado o es inválida.");
            cerrarSesion();
        }
    } catch (error) {
        console.error("Error crítico detectado en la inicialización:", error);
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

            const paci = datospaciente.Persona || datospaciente.persona;
            const correo = datospaciente.Correo || datospaciente.correo;
            const tipoSangreObjeto = datospaciente.TipoSangre || datospaciente.tipoSangre;

            const hoy = new Date();
            const fechin = new Date(datospaciente.fechaNacimiento.fechaDeNacimiento);
            let edad = hoy.getFullYear() - fechin.getFullYear();
            const diferenciaMeses = hoy.getMonth() - fechin.getMonth();
            if (diferenciaMeses < 0 || (diferenciaMeses === 0 && hoy.getDate() < fechin.getDate())) {
                edad--;
            }

            const tipoSangreTexto = tipoSangreObjeto ? (tipoSangreObjeto.tipoDeSangre || tipoSangreObjeto.TipoDeSangre || "No registrado") : "No registrado";
            const nombrepacientecompleto = paci ? `${paci.Nombre || paci.nombre || ''} ${paci.Apellido || paci.apellido || ''}`.trim() : 'Paciente sin nombre';
            const correoTexto = correo ? (correo.CorreoElectronico || correo.correoElectronico || 'Sin correo') : 'Sin correo';
            const departamento = datospaciente.departamento.departamento1;
            const ciudad = datospaciente.ciudad.nombre;

            const infoDiv = document.getElementById("infoPaciente");
            if (infoDiv) {
                infoDiv.innerHTML = `
                    <p><strong>Nombre:</strong> ${nombrepacientecompleto}</p>
                    <p><strong>Correo:</strong> ${correoTexto}</p>
                    <p><strong>Edad:</strong> ${edad}</p>
                    <p><strong>Departamento:</strong> ${departamento}</p>
                    <p><strong>Ciudad:</strong> ${ciudad}</p>
                    <p><strong>Tipo de Sangre:</strong> ${tipoSangreTexto}</p>
                    <div id="estadoPaciente" class="estado">Evaluando historial con Walle-HB...</div>
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
!function (t, e) { "object" == typeof exports && "undefined" != typeof module ? module.exports = e() : "function" == typeof define && define.amd ? define(e) : (t = "undefined" != typeof globalThis ? globalThis : t || self).Chart = e() }(this, (function () {
    "use strict"; return function (t, e) {// Minichart Core para inyección directa en DOM local sin consumo de CPU
        var n = this; n.id = t, n.canvas = document.getElementById(t), n.ctx = n.canvas ? n.canvas.getContext("2d") : null, n.render = function (t, e) { if (!n.ctx) return; var o = n.canvas.getBoundingClientRect(); n.canvas.width = o.width, n.canvas.height = 320; var a = n.ctx, c = o.width, i = 320, r = 50, d = 30, s = c - 70, u = 250; a.clearRect(0, 0, c, i), a.strokeStyle = "#f1f5f9", a.lineWidth = 1, a.font = "11px sans-serif", a.fillStyle = "#64748b"; for (var l = 0; l <= 4; l++) { var f = 8 + 2.5 * l, g = d + u - (f - 8) / 10 * u; a.beginPath(), a.moveTo(r, g), a.lineTo(c - 20, g), a.stroke(), a.fillText(f.toFixed(1), 10, g + 4) } var v = e.map((function (t, e) { return { x: r + (e / (o.length - 1 || 1)) * s, y: d + u - (t - 8) / 10 * u, v: t } })); a.beginPath(), a.strokeStyle = "#818cf8", a.lineWidth = 3, a.lineJoin = "round", v.forEach((function (t, e) { 0 === e ? a.moveTo(t.x, t.y) : a.lineTo(t.x, t.y) })), a.stroke(), v.forEach((function (t, e) { a.beginPath(), a.fillStyle = "#ffffff", a.arc(t.x, t.y, 5, 0, 2 * Math.PI), a.fill(), a.strokeStyle = "#818cf8", a.lineWidth = 2, a.stroke(), a.fillStyle = "#1e293b", a.font = "bold 11px sans-serif", a.fillText(t.v.toFixed(1), t.x - 8, t.y - 10), a.fillStyle = "#64748b", a.font = "10px sans-serif", a.fillText(t[e], t.x - 22, i - 10) })) }
    }
}));


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

    // 1. MODIFICADO: Ahora apunta dinámicamente al nodo de la MAC (sensorId)
    // Se remueven posibles dos puntos ':' por si el usuario los digita
    const macLimpia = sensorId.replace(/:/g, "");
    const firebaseNodoUrl = `${FIREBASE_URL}dispositivos_activos/${macLimpia}.json?nocache=${Date.now()}`;

    // Configurar bucle de consulta activa (Polling) cada 2 segundos a Firebase
    const vigilanteIntervalo = setInterval(async () => {
        try {
            const respuestaFirebase = await fetch(firebaseNodoUrl, { method: "GET" });

            if (respuestaFirebase.ok) {
                const datosHardwareReal = await respuestaFirebase.json();
                console.log("lsamdlma")
                // EVALUACIÓN DATOS REALES: Validamos que el nodo contenga el estado "Exito" que envía tu ESP32
                if (datosHardwareReal && datosHardwareReal.mensaje === "Exito") {

                    // Detener la escucha activa de red de inmediato al capturar el evento
                    clearInterval(vigilanteIntervalo);

                    // REQUISITO EXACTO 2: Mensaje de análisis finalizado
                    loaderTexto.innerText = "Analisis terminado";

                    // Mapear adaptando las propiedades del JSON real de tu ESP32 al formato temporal de tu app
                    datosMedicionTemporal = {
                        valor_hemoglobina: parseFloat(datosHardwareReal.hemoglobina), // Accede a "hemoglobina" de tu ESP32
                        temperatura: parseFloat(datosHardwareReal.temperatura),       // Accede a "temperatura" de tu ESP32
                        sensor_id: sensorId,                                          // Asigna el ID ingresado manualmente
                        timestamp: datosHardwareReal.timestamp || Math.floor(Date.now() / 1000) // Fallback si no viene timestamp del hardware
                    };
                    console.log(datosMedicionTemporal);

                    // 2. MODIFICADO: Petición DELETE para eliminar el nodo de la MAC de inmediato y dejarlo limpio
                    try {
                        await fetch(firebaseNodoUrl, { method: "DELETE" });
                        console.log(`Nodo Firebase de la MAC ${macLimpia} eliminado correctamente.`);
                    } catch (errorDelete) {
                        console.error("Error al intentar limpiar el nodo en Firebase:", errorDelete);
                    }

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
        if (typeof datosMedicionTemporal === 'undefined' || !datosMedicionTemporal) {
            if (vigilanteIntervalo) clearInterval(vigilanteIntervalo);
            document.getElementById("iconoCarga").style.display = "none";
            loaderTexto.innerText = "Tiempo agotado";
            mensaje.innerText = "No se detectó el envío de datos desde el sensor. Inténtelo de nuevo.";
        }
    }, 60000);
}


async function iniciarVinculacionManual() {
    const sensorId = document.getElementById("txtSensorId").value.trim();
    if (!sensorId) {
        alert("Por favor, ingrese un código identificador válido.");
        return;
    }

    // 1. RESTRICCIÓN: Construir la URL de verificación para ver si el nodo ya existe
    const macLimpia = sensorId.replace(/:/g, "");
    const urlVerificacion = `${FIREBASE_URL}dispositivos_activos/${macLimpia}.json?nocache=${Date.now()}`;

    try {
        // Hacemos una consulta rápida de lectura
        const verificarNodo = await fetch(urlVerificacion, { method: "GET" });
        if (verificarNodo.ok) {
            const datosExistentes = await verificarNodo.json();
            // Si el nodo NO es null, significa que ya hay una medición activa de alguien más
            if (datosExistentes !== null) {
                alert("⚠️ El dispositivo sensor ya se encuentra en uso por otro usuario. Por favor, espere a que termine o intente con otra MAC.");
                return; // 🛑 Detiene la función por completo y no permite enlazar
            }
        }
    } catch (error) {
        console.error("Error al verificar la disponibilidad del sensor:", error);
        alert("Hubo un error de conexión al verificar el estado del dispositivo.");
        return;
    }

    // 2. FLUJO NORMAL: Si pasó la verificación (el nodo está vacío/null), procedemos con el diseño y la escucha
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
        loaderTexto.innerText = "Vinculación completa, porfavor utilice el dispositivo";
        mensaje.innerText = "Sincronización establecida. Realice la toma física de la muestra con el lector de hardware.";

        escucharCambiosFirebase(sensorId);
    }, 3000);
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

