
let historialGeneralGlobal = [];

// Instancias nativas independientes para los dos lienzos gráficos
let graficoHemoInstancia = null;
let graficoTempInstancia = null;

// ============================================================================
// MOTOR GRÁFICO AUTÓNOMO (Inmune a caídas de internet o bloqueos locales)
// ============================================================================
function MiniChartSingleLine(canvasId, minVal, maxVal, color, esTemp) {
    var n = this;
    n.canvas = document.getElementById(canvasId);
    n.ctx = n.canvas ? n.canvas.getContext("2d") : null;

    n.render = function (etiquetas, datos) {
        if (!n.ctx || !n.canvas) return;
        var o = n.canvas.getBoundingClientRect();
        n.canvas.width = o.width;
        n.canvas.height = 240;

        var a = n.ctx, c = o.width, i = 240;
        var r = 50, d = 30, s = c - 90, u = 150;

        a.clearRect(0, 0, c, i);
        
        if (datos.length === 0) {
            a.fillStyle = "#64748b";
            a.font = "13px sans-serif";
            a.textAlign = "center";
            a.fillText("No existen registros bajo este criterio de búsqueda", c / 2, i / 2);
            return;
        }

        // --- Rejilla horizontal y Escala Eje Y ---
        a.strokeStyle = "#f1f5f9";
        a.lineWidth = 1;
        a.font = "11px sans-serif";
        a.textAlign = "left";

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
        var puntos = datos.map(function (val, idx) {
            var posX = r + (totalPuntos > 1 ? (idx / (totalPuntos - 1)) * s : s / 2);
            var posY = d + u - ((val - minVal) / rango) * u;
            return { x: posX, y: posY, v: val };
        });

        // Dibujar Línea de Tendencia
        a.beginPath();
        a.strokeStyle = color;
        a.lineWidth = 3;
        a.lineJoin = "round";
        puntos.forEach(function (p, idx) {
            if (idx === 0) a.moveTo(p.x, p.y);
            else a.lineTo(p.x, p.y);
        });
        a.stroke();

        // Dibujar Nodos de Muestreo e Indicadores Numéricos
        puntos.forEach(function (p) {
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

        // Rótulos de Fechas en Eje X con Rotación Preventiva
        a.fillStyle = "#64748b";
        a.font = "10px sans-serif";
        etiquetas.forEach(function (fechaStr, idx) {
            var p = puntos[idx];
            if (p) {
                a.save();
                a.translate(p.x, i - 15);
                a.rotate(-0.15);
                a.fillText(fechaStr, -15, 10);
                a.restore();
            }
        });
    };
}

function inicializarGrafico(etiquetas, valoresHemo, valoresTemp) {
    // 1. Render de Hemoglobina con escala adaptativa expandida
    if (!graficoHemoInstancia) {
        graficoHemoInstancia = new MiniChartSingleLine('graficoHemoglobina', 8, 22, "#818cf8", false);
    }
    graficoHemoInstancia.render(etiquetas, valoresHemo);

    // 2. Render de Temperatura Corporal
    if (!graficoTempInstancia) {
        graficoTempInstancia = new MiniChartSingleLine('graficoTemperatura', 30, 42, "#f97316", true);
    }
    graficoTempInstancia.render(etiquetas, valoresTemp);
}

// ============================================================================
// FLUJO PRIMARIO DE SINCRO CON CONTROLADOR C# (LIBRE DE CABECERAS TOKEN)
// ============================================================================
document.addEventListener("DOMContentLoaded", async function () {
    try {
        const respuesta = await fetch(`${API_URL}Estadistica/historial`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        if (respuesta.ok) {
            historialGeneralGlobal = await respuesta.json();
            ejecutarFiltroCruzado(); // Desencadena el renderizado cruzado inicial
        } else {
            console.error("Error en respuesta HTTP del servidor:", respuesta.status);
            document.getElementById("tablaResultados").innerHTML = '<tr><td colspan="9" style="text-align:center; color: var(--color-anemia); font-weight: 600; padding:30px;">Error al obtener el historial de registros médicos de la base de datos.</td></tr>';
        }
    } catch (error) {
        console.error("Fallo crítico en flujo de red fetch:", error);
        document.getElementById("tablaResultados").innerHTML = '<tr><td colspan="9" style="text-align:center; color: var(--color-anemia); font-weight: 600; padding:30px;">Fallo de conexión crítico con la infraestructura del servidor.</td></tr>';
    }
});

// ============================================================================
// MOTOR DE FILTRADO MULTI-CRITERIO SIMULTÁNEO CRUZADO
// ============================================================================
function ejecutarFiltroCruzado() {
    const selAnio = document.getElementById("fAnio").value;
    const selCiudad = document.getElementById("fCiudad").value;
    const selGenero = document.getElementById("fGenero").value;
    const selEdad = document.getElementById("fEdad").value;
    const selEstado = document.getElementById("fEstado").value;
    const selTermica = document.getElementById("fTermica").value;

    const datosFiltrados = historialGeneralGlobal.filter(item => {
        // --- 1. Filtro Cronológico (Año) ---
        const fStr = item.fechaAnalisis || item.FechaAnalisis;
        let fechaReg = new Date();
        
        if (typeof fStr === "string" && fStr.includes("-") && !fStr.includes("T")) {
            const partes = fStr.split("-");
            fechaReg = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
        } else if (fStr) {
            fechaReg = new Date(fStr);
        }
        
        if (selAnio !== "todos" && fechaReg.getFullYear().toString() !== selAnio) return false;

        // Desglose seguro del árbol jerárquico DTO (.Include de Entity Framework)
        const navRango = item.idRangoHemoglobinaNavigation || item.IdRangoHemoglobinaNavigation || {};

        // --- 2. Filtro Regional (Ciudad) ---
        const ciudadItem = navRango.idCiudadNavigation?.nombre || navRango.IdCiudadNavigation?.nombre || "";
        if (selCiudad !== "todos" && ciudadItem !== selCiudad) return false;

        // --- 3. Filtro Género ---
        const generoItem = navRango.idGeneroNavigation?.nombre || navRango.IdGeneroNavigation?.nombre || "";
        if (selGenero !== "todos" && generoItem.toLowerCase() !== selGenero.toLowerCase()) return false;

        // --- 4. Filtro por Rango Etario Real ---
        const edadItem = navRango.idEdadNavigation?.edad || navRango.IdEdadNavigation?.edad || 0;
        if (selEdad === "infantil" && edadItem > 12) return false;
        if (selEdad === "adolescente" && (edadItem <= 12 || edadItem > 17)) return false;
        if (selEdad === "adulto" && edadItem < 18) return false;

        // --- 5. Filtro Estado Clínico Cruzado con Límites Dinámicos de Base de Datos ---
        const hVal = parseFloat(item.valorHemoglobina || item.ValorHemoglobina || 0);
        const minVal = parseFloat(navRango.valorMin || navRango.ValorMin || 0);
        const maxVal = parseFloat(navRango.valorMax || navRango.ValorMax || 100);
        
        let diagnosticoCalculado = "Estable";
        if (hVal < minVal) diagnosticoCalculado = "Anemia";
        else if (hVal > maxVal) diagnosticoCalculado = "Poliglobulia";

        if (selEstado !== "todos" && diagnosticoCalculado !== selEstado) return false;

        // --- 6. Filtro Térmico de Telemetría Biométrica ---
        const tVal = parseFloat(item.temperatura || item.Temperatura || 0);
        if (selTermica === "normal" && (tVal < 36.0 || tVal > 37.3)) return false;
        if (selTermica === "fiebre" && tVal <= 37.3) return false;
        if (selTermica === "hipo" && tVal >= 36.0) return false;

        // Adjuntamos temporalmente el diagnóstico mapeado para renderizado inmediato
        item.diagnosticoEvaluado = diagnosticoCalculado;
        return true;
    });

    procesarYRenderizarTodo(datosFiltrados);
}

// ============================================================================
// CONSTRUCCIÓN CUADRO DE MANDOS KPIs, RENDER DE LIENZOS Y TABLA DINÁMICA
// ============================================================================
function procesarYRenderizarTodo(datos) {
    let conteoAnemia = 0;
    let conteoPoliglobulia = 0;
    let conteoEstable = 0;

    const tbody = document.getElementById("tablaResultados");
    if (!tbody) return;
    tbody.innerHTML = "";

    // Manejo de estados de error / vacíos sin romper ejecuciones previas
    if (!datos || datos.length === 0) {
        document.getElementById("kpiTotal").innerText = "0";
        document.getElementById("kpiAnemia").innerText = "0";
        document.getElementById("kpiEstable").innerText = "0";
        document.getElementById("kpiPoliglobulia").innerText = "0";
        
        inicializarGrafico([], [], []);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color: var(--text-muted); padding:30px;">Ninguna muestra médica registrada coincide con los filtros establecidos.</td></tr>';
        return;
    }

    // Ordenamiento cronológico explícito (Asegura curvas correctas de izquierda a derecha)
    const ordenados = datos.sort((a, b) => {
        const fA = new Date(a.fechaAnalisis || a.FechaAnalisis);
        const fB = new Date(b.fechaAnalisis || b.FechaAnalisis);
        return fA - fB;
    });

    let htmlFilas = "";
    ordenados.forEach(item => {
        const nav = item.idRangoHemoglobinaNavigation || item.IdRangoHemoglobinaNavigation || {};
        
        // Formateo seguro de la cadena de fecha
        const fStr = item.fechaAnalisis || item.FechaAnalisis;
        let f = new Date(fStr);
        if (typeof fStr === "string" && fStr.includes("-") && !fStr.includes("T")) {
            const p = fStr.split("-");
            f = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
        }
        const fechaFormateada = isNaN(f.getTime()) ? "S/D" : `${f.getDate()}/${f.getMonth() + 1}/${f.getFullYear()}`;
        
        // Clasificación de estilo por distintivos y acumuladores KPI
        let badgeClass = "badge-normal";
        if (item.diagnosticoEvaluado === "Anemia") { 
            conteoAnemia++; 
            badgeClass = "badge-anemia"; 
        } else if (item.diagnosticoEvaluado === "Poliglobulia") { 
            conteoPoliglobulia++; 
            badgeClass = "badge-poliglobulia"; 
        } else { 
            conteoEstable++; 
        }

        // Extracción modular segura del árbol DTO anidado
        const ciudadNombre = nav.idCiudadNavigation?.nombre || nav.IdCiudadNavigation?.nombre || "S/D";
        const altitudValor = parseFloat(nav.idCiudadNavigation?.altitud || nav.IdCiudadNavigation?.altitud || 0);
        const generoNombre = nav.idGeneroNavigation?.nombre || nav.IdGeneroNavigation?.nombre || "S/D";
        const edadValor = nav.idEdadNavigation?.edad || nav.IdEdadNavigation?.edad || "S/D";

        htmlFilas += `
            <tr>
                <td><strong>#${item.idUsuario || item.IdUsuario || "S/D"}</strong></td>
                <td>${fechaFormateada}</td>
                <td style="font-weight:700; color:#1e293b;">${parseFloat(item.valorHemoglobina || item.ValorHemoglobina || 0).toFixed(2)} g/dL</td>
                <td style="font-weight:500;">${parseFloat(item.temperatura || item.Temperatura || 0).toFixed(1)} °C</td>
                <td>${edadValor} años</td>
                <td>${ciudadNombre}</td>
                <td>${altitudValor.toFixed(0)} msnm</td>
                <td>${generoNombre}</td>
                <td><span class="badge ${badgeClass}">${item.diagnosticoEvaluado}</span></td>
            </tr>
        `;
    });

    // Inyección optimizada de fragmentos al DOM de la tabla
    tbody.innerHTML = htmlFilas;

    // Sincronización analítica de indicadores numéricos superiores
    document.getElementById("kpiTotal").innerText = datos.length;
    document.getElementById("kpiAnemia").innerText = conteoAnemia;
    document.getElementById("kpiEstable").innerText = conteoEstable;
    document.getElementById("kpiPoliglobulia").innerText = conteoPoliglobulia;

    // Extracción secuencial de vectores cartesianos para el eje X
    const etiquetas = ordenados.map(r => {
        const fStr = r.fechaAnalisis || r.FechaAnalisis;
        let f = new Date(fStr);
        if (typeof fStr === "string" && fStr.includes("-") && !fStr.includes("T")) {
            const p = fStr.split("-"); 
            f = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
        }
        return `${f.getDate()}/${f.getMonth() + 1}`;
    });
    
    const valoresHemo = ordenados.map(r => parseFloat(r.valorHemoglobina || r.ValorHemoglobina || 0));
    const valoresTemp = ordenados.map(r => parseFloat(r.temperatura || r.Temperatura || 0));

    // Forzar redibujado de los componentes de lienzo gráfico
    inicializarGrafico(etiquetas, valoresHemo, valoresTemp);
}

// ============================================================================
// BLINDAJE: REINICIO COMPLETO DEL PANEL DE CONTROL ANALÍTICO
// ============================================================================
function restablecerFiltrosGenerales() {
    document.getElementById("fAnio").value = "todos";
    document.getElementById("fCiudad").value = "todos";
    document.getElementById("fGenero").value = "todos";
    document.getElementById("fEdad").value = "todos";
    document.getElementById("fEstado").value = "todos";
    document.getElementById("fTermica").value = "todos";
    ejecutarFiltroCruzado();
}

// Vinculación definitiva y forzada a la ventana global de ejecución de la pestaña
window.ejecutarFiltroCruzado = ejecutarFiltroCruzado;
window.restablecerFiltrosGenerales = restablecerFiltrosGenerales;

// ============================================================================
// CONTROLADORES INTERACTIVOS DE VENTANA FLOTANTE (POP-UP)
// ============================================================================
function abrirPopUpTabla() {
    const modal = document.getElementById("modalTablaAnalitica");
    if (modal) {
        modal.style.display = "flex";
        // Previene el scroll del fondo mientras está la tabla abierta
        document.body.style.overflow = "hidden"; 
    }
}

function cerrarPopUpTabla() {
    const modal = document.getElementById("modalTablaAnalitica");
    if (modal) {
        modal.style.display = "none";
        // Devuelve el scroll normal a la página original
        document.body.style.overflow = "auto"; 
    }
}

// Vinculación explícita a la ventana global de ejecución de la pestaña
window.abrirPopUpTabla = abrirPopUpTabla;
window.cerrarPopUpTabla = cerrarPopUpTabla;

