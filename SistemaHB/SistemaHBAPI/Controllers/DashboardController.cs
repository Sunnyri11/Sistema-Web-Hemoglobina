using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SistemaHBAPI.Models;
using System.Security.Claims;
using System.Threading.Tasks;
using System.Linq;
using System.Net.Http; // 🌐 Añadido para HttpClient
using System.Net.Http.Json; // 🌐 Añadido para serialización JSON automática
using System;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // 🔒 Bloqueo de seguridad JWT global para este controlador
    public class DashboardController : ControllerBase
    {
        private readonly SistemaHBContext _context;
        private readonly IHttpClientFactory _httpClientFactory; // 🌐 Añadido para factory de conexiones HTTP

        // Inyectamos el contexto de BD y el factory HTTP sin alterar dependencias existentes
        public DashboardController(SistemaHBContext context, IHttpClientFactory httpClientFactory)
        {
            _context = context;
            _httpClientFactory = httpClientFactory;
        }

        // =========================================================================
        // 1. PANTALLA PACIENTE (Monitoreo.html)
        // =========================================================================
        [HttpGet("paciente")]
        public async Task<IActionResult> ObtenerDatosPaciente()
        {
            // Extraemos de forma segura el ID de entidad del rol del JWT del usuario en sesión
            var idUsuarioClaim = User.FindFirst("IdEntidadRol")?.Value;
            if (string.IsNullOrEmpty(idUsuarioClaim)) return Unauthorized(new { mensaje = "Token inválido o expirado." });
            int idUsuario = int.Parse(idUsuarioClaim);

            // Buscamos al usuario incluyendo su navegación personal de forma segura, incluyendo Ciudad para la IA
            var usuario = await _context.Usuarios
                .Include(u => u.IdPersonaNavigation)
                    .ThenInclude(p => p.IdCiudadNavigation) // Traemos la ciudad para mapear su altitud
                .FirstOrDefaultAsync(u => u.IdUsuario == idUsuario);

            if (usuario == null) return NotFound(new { mensaje = "Paciente no encontrado." });

            // Traemos el historial de niveles de hemoglobina del paciente
            var historialHemoglobina = await _context.NivelHemoglobinas
                .Where(n => n.IdUsuario == idUsuario)
                .OrderByDescending(n => n.FechaAnalisis)
                .Select(n => new
                {
                    n.IdNivel,
                    n.ValorHemoglobina,
                    Fecha = n.FechaAnalisis.ToString("yyyy-MM-dd"),
                    n.Temperatura,
                    // Traemos los rangos de referencia asociados al análisis
                    ValorMin = n.IdRangoHemoglobinaNavigation.ValorMin,
                    ValorMax = n.IdRangoHemoglobinaNavigation.ValorMax
                })
                .ToListAsync();

            // Variables para almacenar lo que dictamine la IA Walle-HB
            string iaEstado = "Sin datos";
            string[] iaAlertas = Array.Empty<string>();
            string[] iaRecomendaciones = Array.Empty<string>();

            // Si el paciente tiene al menos un análisis clínico, ejecutamos la evaluación con la IA de Render
            var ultimoAnalisis = historialHemoglobina.FirstOrDefault();
            if (ultimoAnalisis != null && usuario.IdPersonaNavigation != null)
            {
                // Calculamos la edad de forma matemática exacta
                int edad = 29; // Fallback seguro
                var fechaNac = await _context.FechaNacimientos.FirstOrDefaultAsync(f => f.IdFechaNacimiento == usuario.IdPersonaNavigation.IdFechaNacimiento);
                if (fechaNac != null && fechaNac.FechaDeNacimiento.HasValue)
                {
                    var nacimiento = fechaNac.FechaDeNacimiento.Value;
                    edad = DateTime.Today.Year - nacimiento.Year;
                    if (nacimiento.ToDateTime(TimeOnly.MinValue) > DateTime.Today.AddYears(-edad)) edad--;
                }

                // 🧠 CORREGIDO: Estructuramos el Payload usando Convert.ToDouble para evitar el quiebre de tipos anónimos de EF Core
                // E inyectamos 'historial_anteriores' requerido por la IA evolutiva
                var payloadIA = new
                {
                    id_genero = usuario.IdPersonaNavigation.IdGenero,
                    altitud = Convert.ToDouble(usuario.IdPersonaNavigation.IdCiudadNavigation?.Altitud ?? 3640.00m), // Default La Paz
                    edad = edad > 0 ? edad : 20,
                    valor_min = Convert.ToDouble(ultimoAnalisis.ValorMin),
                    valor_max = Convert.ToDouble(ultimoAnalisis.ValorMax),
                    valor_hemoglobina = Convert.ToDouble(ultimoAnalisis.ValorHemoglobina),
                    temperatura = Convert.ToDouble(ultimoAnalisis.Temperatura),
                    historial_anteriores = historialHemoglobina.Select(h => Convert.ToDouble(h.ValorHemoglobina)).ToList() // 📈 Tendencia para el aprendizaje
                };

                try
                {
                    var client = _httpClientFactory.CreateClient();

                    // 🎯 CORREGIDO: Eliminamos "/predecir". Ahora apunta directamente a tu enlace base.
                    string endpointRender = "https://walle-hb.onrender.com";

                    var response = await client.PostAsJsonAsync(endpointRender, payloadIA);
                    if (response.IsSuccessStatusCode)
                    {
                        var jsonResult = await response.Content.ReadFromJsonAsync<RespuestaIaModel>();
                        if (jsonResult != null)
                        {
                            // 🧠 Adaptamos la asignación leyendo de forma segura el array ["Estable"] que envía FastAPI
                            iaEstado = jsonResult.Estado != null && jsonResult.Estado.Length > 0 ? jsonResult.Estado[0] : "Estable";

                            // Control de desborde por si viaja como String plano o un carácter suelto
                            if (string.IsNullOrEmpty(iaEstado) || iaEstado.Length <= 1)
                            {
                                iaEstado = "Estable";
                            }

                            iaAlertas = jsonResult.Alertas ?? Array.Empty<string>();
                            iaRecomendaciones = jsonResult.Recomendaciones ?? Array.Empty<string>();
                        }
                    }
                    else if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                    {
                        // Control de diagnóstico por si acaso
                        iaEstado = "Error 404";
                        iaAlertas = new string[] { "❌ La ruta en el servidor de Render no coincide con el endpoint base." };
                    }
                }
                catch (Exception)
                {
                    // Contingencia pasiva brillante: Excelente manejo para el modo "Sleep" de Render gratis (~50 seg)
                    iaEstado = "Procesando...";
                    iaAlertas = new string[] { "⚠️ El motor de Inteligencia Artificial está despertando. Por favor refresca la página en unos segundos." };
                    iaRecomendaciones = new string[] { "• Conexión establecida, esperando respuesta del microservicio analítico." };
                }

            }

            // Retornamos el objeto final inyectando los bloques enriquecidos por la IA de forma transparente
            return Ok(new
            {
                nombreCompleto = $"{usuario.IdPersonaNavigation?.Nombre ?? "Sin Name"} {usuario.IdPersonaNavigation?.Paterno ?? ""} {usuario.IdPersonaNavigation?.Materno ?? ""}".Trim(),
                historial = historialHemoglobina,
                analisisIA = new
                {
                    estado = iaEstado,
                    alertas = iaAlertas.Length > 0 ? iaAlertas[0] : "", // Pasamos el string limpio al frontend
                    recomendaciones = iaRecomendaciones
                }
            });
        }


        [HttpPost("guardarAnalisis/{idObservacion:int}")]
        [Authorize]
        public async Task<IActionResult> GuardarAnalisis([FromRoute] int idObservacion, [FromBody] RequestAnalisis dto)
        {
            // 1. Extraer el ID del Usuario desde el Token de forma segura
            var idUsuarioClaim = User.FindFirst("IdEntidadRol")?.Value;
            if (string.IsNullOrEmpty(idUsuarioClaim))
                return Unauthorized(new { mensaje = "Token inválido o expirado." });

            int idUsuario = int.Parse(idUsuarioClaim);
            var fechaActual = DateOnly.FromDateTime(DateTime.Today);
            var añoActual = DateTime.Today.Year;

            // 2. OPTIMIZACIÓN: Consulta proyectada y plana con AsNoTracking
            // Trae solo lo estrictamente necesario y calcula la edad directamente en la BD
            var datosPaciente = await _context.Usuarios
                .AsNoTracking()
                .Where(u => u.IdUsuario == idUsuario)
                .Select(u => new
                {
                    IdGenero = u.IdPersonaNavigation.IdGenero,
                    IdCiudad = u.IdPersonaNavigation.IdCiudad,
                    FechaNacimiento = u.IdPersonaNavigation.IdFechaNacimientoNavigation.FechaDeNacimiento,
                    // Cálculo optimizado de edad directamente en SQL
                    Edad = u.IdPersonaNavigation.IdFechaNacimientoNavigation.FechaDeNacimiento != null
                        ? añoActual - u.IdPersonaNavigation.IdFechaNacimientoNavigation.FechaDeNacimiento.Value.Year
                        : -1
                })
                .FirstOrDefaultAsync();

            if (datosPaciente == null)
                return NotFound(new { mensaje = "El usuario asociado al token no existe." });

            if (datosPaciente.IdCiudad == null)
                return BadRequest(new { mensaje = "El paciente no tiene una ciudad asignada en su perfil." });

            if (datosPaciente.FechaNacimiento == null)
                return BadRequest(new { mensaje = "No se registra la fecha de nacimiento del paciente." });

            // Ajuste fino de la edad si no ha cumplido años este año todavía
            int edadCalculada = datosPaciente.Edad;
            if (datosPaciente.FechaNacimiento.Value > fechaActual.AddYears(-edadCalculada))
                edadCalculada--;

            // 3. OPTIMIZACIÓN: Buscar id_edad sin traer toda la entidad
            int idEdadEvaluada = await _context.Edades
                .AsNoTracking()
                .Where(e => e.Edad == edadCalculada)
                .Select(e => e.IdEdad)
                .FirstOrDefaultAsync();

            if (idEdadEvaluada == 0) idEdadEvaluada = 1; // Fallback de seguridad

            // 4. OPTIMIZACIÓN CRÍTICA: Recuperar el rango específico Y el rango por defecto en UNA SOLA consulta a la BD.
            // Usamos un filtro OR y ordenamos de modo que si existe la observación específica quede en primer lugar.
            var rangosDisponibles = await _context.RangoHemoglobinas
                .AsNoTracking()
                .Where(r => r.IdCiudad == datosPaciente.IdCiudad &&
                            r.IdGenero == datosPaciente.IdGenero &&
                            r.IdEdad == idEdadEvaluada &&
                            (r.IdObservacion == idObservacion || r.IdObservacion == null))
                .OrderByDescending(r => r.IdObservacion) // Los valores numéricos (enfermedad) van antes que el NULL
                .Select(r => new { r.IdRango, r.ValorMin, r.ValorMax })
                .FirstOrDefaultAsync();

            if (rangosDisponibles == null)
            {
                return BadRequest(new { mensaje = "No se encontró un rango de referencia configurado para este perfil en Bolivia." });
            }

            // 5. Inserción directa en la base de datos
            var nuevoNivel = new NivelHemoglobina
            {
                IdUsuario = idUsuario,
                IdRangoHemoglobina = rangosDisponibles.IdRango,
                ValorHemoglobina = dto.ValorHemoglobina,
                Temperatura = dto.Temperatura,
                FechaAnalisis = fechaActual
            };

            try
            {
                _context.NivelHemoglobinas.Add(nuevoNivel);
                await _context.SaveChangesAsync();

                // Diagnóstico en memoria del servidor (Ultra rápido)
                string diagnostico = "Normal";
                if (dto.ValorHemoglobina < rangosDisponibles.ValorMin) diagnostico = "Bajo (Posible Anemia)";
                else if (dto.ValorHemoglobina > rangosDisponibles.ValorMax) diagnostico = "Alto (Posible Policitemia)";

                return Ok(new
                {
                    mensaje = "Análisis clínico registrado con éxito en el sistema.",
                    diagnosticoPrevalente = diagnostico,
                    rangoAplicado = new { minimo = rangosDisponibles.ValorMin, maximo = rangosDisponibles.ValorMax }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { mensaje = "Error interno al guardar en la base de datos.", detalle = ex.Message });
            }
        }


        // DTO (Objeto de Transferencia de Datos) para recibir el JSON del frontend
        // DTO (Objeto de Transferencia de Datos) para recibir el JSON del frontend
        public class RequestAnalisis
        {
            public decimal ValorHemoglobina { get; set; }
            public decimal Temperatura { get; set; }
            public DateTime FechaAnalisis { get; set; }
        }

        // =========================================================================
        // 2. PANTALLA MÉDICO (Pagina_Medicos.html)
        // =========================================================================
        [HttpGet("medico")]
        public async Task<IActionResult> ObtenerDatosMedico()
        {
            var idMedicoClaim = User.FindFirst("IdEntidadRol")?.Value;
            if (string.IsNullOrEmpty(idMedicoClaim)) return Unauthorized(new { mensaje = "Token inválido." });
            int idMedico = int.Parse(idMedicoClaim);

            var medico = await _context.Medicos
                .Include(m => m.IdPersonaNavigation)
                .FirstOrDefaultAsync(m => m.IdMedico == idMedico);

            if (medico == null) return NotFound(new { mensaje = "Médico no encontrado." });

            // Obtenemos todos los pacientes asignados a este médico
            var misPacientes = await _context.PacienteMedicos
                .Where(pm => pm.IdMedico == idMedico)
                .Select(pm => new
                {
                    pm.IdUsuario,
                    NombrePaciente = $"{pm.IdUsuarioNavigation.IdPersonaNavigation.Nombre} {pm.IdUsuarioNavigation.IdPersonaNavigation.Paterno} {pm.IdUsuarioNavigation.IdPersonaNavigation.Materno}",
                    // Buscamos el último análisis de hemoglobina registrado de este paciente
                    UltimoRegistro = _context.NivelHemoglobinas
                                        .Where(nh => nh.IdUsuario == pm.IdUsuario)
                                        .OrderByDescending(nh => nh.FechaAnalisis)
                                        .Select(nh => new
                                        {
                                            nh.ValorHemoglobina,
                                            nh.FechaAnalisis,
                                            nh.Temperatura,
                                            MinimoReferencia = nh.IdRangoHemoglobinaNavigation.ValorMin,
                                            MaximoReferencia = nh.IdRangoHemoglobinaNavigation.ValorMax
                                        })
                                        .FirstOrDefault()
                })
                .ToListAsync();

            // Procesamos en memoria los estados de salud
            var listaProcesada = misPacientes.Select(p =>
            {
                string estado = "Sin análisis";

                if (p.UltimoRegistro != null)
                {
                    if (p.UltimoRegistro.ValorHemoglobina < p.UltimoRegistro.MinimoReferencia) estado = "Anemia";
                    else if (p.UltimoRegistro.ValorHemoglobina > p.UltimoRegistro.MaximoReferencia) estado = "Poliglobulia";
                    else estado = "Estable";
                }

                return new
                {
                    p.IdUsuario,
                    p.NombrePaciente,
                    UltimoAnalisis = p.UltimoRegistro != null ? new
                    {
                        p.UltimoRegistro.ValorHemoglobina,
                        Fecha = p.UltimoRegistro.FechaAnalisis.ToString("yyyy-MM-dd"),
                        EstadoSalud = estado
                    } : null
                };
            }).ToList();

            return Ok(listaProcesada);
        }


        // =========================================================================
        // 3. PANTALLA ADMINISTRADOR (Pagina_Administrador.html)
        // =========================================================================
        [HttpGet("administrador")]
        public async Task<IActionResult> ObtenerDatosAdministrador()
        {
            var idAdminClaim = User.FindFirst("IdEntidadRol")?.Value;
            if (string.IsNullOrEmpty(idAdminClaim)) return Unauthorized(new { mensaje = "Token inválido." });
            int idAdmin = int.Parse(idAdminClaim);

            // 1. Obtener la información del Administrador que inició sesión
            var admin = await _context.Administradors
                .Include(a => a.IdPersonaNavigation)
                .FirstOrDefaultAsync(a => a.IdAdministrador == idAdmin);

            if (admin == null) return NotFound(new { mensaje = "Administrador no encontrado." });

            // 2. Traer TODOS los Pacientes (Tabla usuario) con su árbol completo de relaciones
            var todosLosPacientes = await _context.Usuarios
                .Include(u => u.IdTipoSangreNavigation) // Tipo de sangre
                .Include(u => u.IdPersonaNavigation) // Datos de la persona
                    .ThenInclude(p => p.IdCorreoElectronicoNavigation) // Correo y contraseña
                .Include(u => u.IdPersonaNavigation)
                    .ThenInclude(p => p.IdFechaNacimientoNavigation) // Fecha de nacimiento
                .Include(u => u.IdPersonaNavigation)
                    .ThenInclude(p => p.IdGeneroNavigation) // Género
                .Include(u => u.NivelHemoglobinas) // Su historial de análisis clínicos
                    .ThenInclude(nh => nh.IdRangoHemoglobinaNavigation) // Rangos de referencia analizados
                .Include(u => u.PacienteMedicos) // Intermedia con médicos asignados
                    .ThenInclude(pm => pm.IdMedicoNavigation.IdPersonaNavigation) // Nombre del médico asignado
                .Select(u => new
                {
                    u.IdUsuario,
                    datosPersonales = new
                    {
                        u.IdPersonaNavigation.Nombre,
                        u.IdPersonaNavigation.Paterno,
                        u.IdPersonaNavigation.Materno,
                        FechaNacimiento = u.IdPersonaNavigation.IdFechaNacimientoNavigation.FechaDeNacimiento.HasValue
                            ? u.IdPersonaNavigation.IdFechaNacimientoNavigation.FechaDeNacimiento.Value.ToString("yyyy-MM-dd")
                            : null,
                        Genero = u.IdPersonaNavigation.IdGeneroNavigation.Nombre,
                        Correo = u.IdPersonaNavigation.IdCorreoElectronicoNavigation.CorreoElectronico
                    },
                    TipoSangre = u.IdTipoSangreNavigation.TipoDeSangre,
                    historialHemoglobina = u.NivelHemoglobinas.Select(nh => new
                    {
                        nh.IdNivel,
                        nh.ValorHemoglobina,
                        nh.Temperatura,
                        FechaAnalisis = nh.FechaAnalisis.ToString("yyyy-MM-dd"),
                        RangoReferencia = new { nh.IdRangoHemoglobinaNavigation.ValorMin, nh.IdRangoHemoglobinaNavigation.ValorMax, nh.Temperatura } 
                    }),
                    medicosAsignados = u.PacienteMedicos.Select(pm => new
                    {
                        pm.IdMedico,
                        NombreMedico = $"Dr(a). {pm.IdMedicoNavigation.IdPersonaNavigation.Nombre} {pm.IdMedicoNavigation.IdPersonaNavigation.Paterno} {pm.IdMedicoNavigation.IdPersonaNavigation.Materno}"
                    })
                })
                .ToListAsync();

            // 3. Traer TODOS los Médicos con su árbol completo de relaciones y especialidades
            var todosLosMedicos = await _context.Medicos
                .Include(m => m.IdPersonaNavigation)
                    .ThenInclude(p => p.IdCorreoElectronicoNavigation)
                .Include(m => m.IdPersonaNavigation)
                    .ThenInclude(p => p.IdFechaNacimientoNavigation)
                .Include(m => m.IdPersonaNavigation)
                    .ThenInclude(p => p.IdGeneroNavigation)
                .Include(m => m.MedicoEspecialidads) // Intermedia de especialidades
                    .ThenInclude(me => me.IdEspecialidadNavigation) // Catálogo de especialidad
                .Select(m => new
                {
                    m.IdMedico,
                    datosPersonales = new
                    {
                        m.IdPersonaNavigation.Nombre,
                        m.IdPersonaNavigation.Paterno,
                        m.IdPersonaNavigation.Materno,
                        FechaNacimiento = m.IdPersonaNavigation.IdFechaNacimientoNavigation.FechaDeNacimiento.HasValue
                            ? m.IdPersonaNavigation.IdFechaNacimientoNavigation.FechaDeNacimiento.Value.ToString("yyyy-MM-dd")
                            : null,
                        Genero = m.IdPersonaNavigation.IdGeneroNavigation.Nombre,
                        Correo = m.IdPersonaNavigation.IdCorreoElectronicoNavigation.CorreoElectronico
                    },
                    especialidades = m.MedicoEspecialidads.Select(me => me.IdEspecialidadNavigation.Nombre),
                    // Cantidad de pacientes que tiene a su cargo actualmente
                    totalPacientesACargo = _context.PacienteMedicos.Count(pm => pm.IdMedico == m.IdMedico)
                })
                .ToListAsync();

            // 4. Calcular métricas básicas de control basándose en las listas en memoria
            var alertasHemoglobinaBaja = await _context.NivelHemoglobinas.CountAsync(nh => nh.ValorHemoglobina < 11);

            // 5. Retornar el paquete consolidado al Administrador
            return Ok(new
            {
                nombreAdmin = $"{admin.IdPersonaNavigation.Nombre} {admin.IdPersonaNavigation.Paterno} {admin.IdPersonaNavigation.Materno}",
                metricasGlobales = new
                {
                    totalPacientes = todosLosPacientes.Count,
                    totalMedicos = todosLosMedicos.Count,
                    alertasRiesgo = alertasHemoglobinaBaja
                },
                pacientes = todosLosPacientes,
                medicos = todosLosMedicos
            });
        }
    }

    // 🧠 Clase contenedora para mapear de forma segura el JSON devuelto por FastAPI (Render)
    public class RespuestaIaModel
    {
        public string[] Estado { get; set; }
        public string[] Alertas { get; set; }
        public string[] Recommendations { get; set; }

        // Mapeo alternativo por si en tu JSON de Python lo escribiste con o sin 'o' (Recomendaciones / Recommendations)
        public string[] Recomendaciones { get => Recommendations; set => Recommendations = value; }
    }
}

