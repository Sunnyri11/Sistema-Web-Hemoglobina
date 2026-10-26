using BibliotecaSistemaHB;
using BibliotecaSistemaHB.Utilidades;
using BibliotecaSistemaHB.Walle;
using Microsoft.EntityFrameworkCore;
using SistemaHBAPI.Models;
using SistemaHBAPI.Services.IA;

namespace SistemaHBAPI.Services.Datos
{
    public interface IDashboardService
    {
        Task<Resultado> ObtenerPacienteAsync(int idUsuario);
        Task<Resultado> GuardarAnalisisAsync(int idUsuario, int idObservacion, RequestAnalisis dto);
        Task<Resultado> ObtenerMedicoAsync(int idMedico);
        Task<Resultado> ObtenerAdministradorAsync(int idAdministrador);
    }

    public sealed class DashboardService : IDashboardService
    {
        private const double AltitudPorDefecto = 3640.00; // La Paz
        private const int EdadPorDefecto = 29;

        private readonly SistemaHBContext _context;
        private readonly IWalleService _walle;

        public DashboardService(SistemaHBContext context, IWalleService walle)
        {
            _context = context;
            _walle = walle;
        }

        // =====================================================================
        // PACIENTE (Monitoreo.html)
        // =====================================================================
        public async Task<Resultado> ObtenerPacienteAsync(int idUsuario)
        {
            var usuario = await _context.Usuarios
                .Include(u => u.IdPersonaNavigation).ThenInclude(p => p!.IdCiudadNavigation)
                .Include(u => u.IdPersonaNavigation).ThenInclude(p => p!.IdFechaNacimientoNavigation)
                .FirstOrDefaultAsync(u => u.IdUsuario == idUsuario);

            if (usuario == null)
                return Resultado.NoEncontrado(new { mensaje = "Paciente no encontrado." });

            var persona = usuario.IdPersonaNavigation;

            // Más nuevo primero: el primero es "el último dato" que se le envía a Walle-HB.
            var historial = await _context.NivelHemoglobinas
                .Where(n => n.IdUsuario == idUsuario)
                .OrderByDescending(n => n.FechaAnalisis)
                .Select(n => new RegistroHemoglobinaDto
                {
                    IdNivel = n.IdNivel,
                    ValorHemoglobina = n.ValorHemoglobina,
                    Fecha = n.FechaAnalisis.ToString("yyyy-MM-dd"),
                    Temperatura = n.Temperatura,
                    ValorMin = n.IdRangoHemoglobinaNavigation.ValorMin,
                    ValorMax = n.IdRangoHemoglobinaNavigation.ValorMax
                })
                .ToListAsync();

            var analisisIa = new AnalisisIaDto();
            if (historial.Count > 0 && persona != null)
            {
                int edad = CalcularEdad(persona.IdFechaNacimientoNavigation?.FechaDeNacimiento);
                double altitud = persona.IdCiudadNavigation != null
                    ? Convert.ToDouble(persona.IdCiudadNavigation.Altitud)
                    : AltitudPorDefecto;

                analisisIa = await _walle.AnalizarAsync(idUsuario, persona.IdGenero, altitud, edad, historial);
            }

            return Resultado.Ok(new
            {
                nombreCompleto = $"{persona?.Nombre ?? "Sin Name"} {persona?.Paterno ?? ""} {persona?.Materno ?? ""}".Trim(),
                historial,
                analisisIA = analisisIa
            });
        }

        private static int CalcularEdad(DateOnly? nacimiento) =>
            nacimiento.HasValue ? Math.Max(CalculadoraEdad.Calcular(nacimiento.Value), 0) : EdadPorDefecto;

        // =====================================================================
        // GUARDAR ANÁLISIS
        // =====================================================================
        public async Task<Resultado> GuardarAnalisisAsync(int idUsuario, int idObservacion, RequestAnalisis dto)
        {
            var hoy = DateOnly.FromDateTime(DateTime.Today);

            var paciente = await _context.Usuarios
                .AsNoTracking()
                .Where(u => u.IdUsuario == idUsuario)
                .Select(u => new
                {
                    u.IdPersonaNavigation!.IdGenero,
                    u.IdPersonaNavigation.IdCiudad,
                    u.IdPersonaNavigation.IdFechaNacimientoNavigation!.FechaDeNacimiento
                })
                .FirstOrDefaultAsync();

            if (paciente == null)
                return Resultado.NoEncontrado(new { mensaje = "El usuario asociado al token no existe." });

            if (paciente.IdCiudad == 0)
                return Resultado.BadRequest(new { mensaje = "El paciente no tiene una ciudad asignada en su perfil." });

            if (paciente.FechaDeNacimiento == null)
                return Resultado.BadRequest(new { mensaje = "No se registra la fecha de nacimiento del paciente." });

            int edad = CalculadoraEdad.Calcular(paciente.FechaDeNacimiento.Value, hoy);

            int idEdad = await _context.Edades
                .AsNoTracking()
                .Where(e => e.Edad == edad)
                .Select(e => e.IdEdad)
                .FirstOrDefaultAsync();
            if (idEdad == 0) idEdad = 1;

            // El rango de la observación elegida (si existe) tiene prioridad sobre el rango base (observación NULL).
            var rango = await _context.RangoHemoglobinas
                .AsNoTracking()
                .Where(r => r.IdCiudad == paciente.IdCiudad &&
                            r.IdGenero == paciente.IdGenero &&
                            r.IdEdad == idEdad &&
                            (r.IdObservacion == idObservacion || r.IdObservacion == null))
                .OrderByDescending(r => r.IdObservacion)
                .Select(r => new { r.IdRango, r.ValorMin, r.ValorMax })
                .FirstOrDefaultAsync();

            if (rango == null)
                return Resultado.BadRequest(new { mensaje = "No se encontró un rango de referencia configurado para este perfil en Bolivia." });

            try
            {
                _context.NivelHemoglobinas.Add(new NivelHemoglobina
                {
                    IdUsuario = idUsuario,
                    IdRangoHemoglobina = rango.IdRango,
                    ValorHemoglobina = dto.ValorHemoglobina,
                    Temperatura = dto.Temperatura,
                    FechaAnalisis = hoy
                });
                await _context.SaveChangesAsync();

                string diagnostico = "Normal";
                if (dto.ValorHemoglobina < rango.ValorMin) diagnostico = "Bajo (Posible Anemia)";
                else if (dto.ValorHemoglobina > rango.ValorMax) diagnostico = "Alto (Posible Policitemia)";

                return Resultado.Ok(new
                {
                    mensaje = "Análisis clínico registrado con éxito en el sistema.",
                    diagnosticoPrevalente = diagnostico,
                    rangoAplicado = new { minimo = rango.ValorMin, maximo = rango.ValorMax }
                });
            }
            catch (Exception ex)
            {
                return Resultado.ErrorInterno(new { mensaje = "Error interno al guardar en la base de datos.", detalle = ex.Message });
            }
        }

        // =====================================================================
        // MÉDICO (Pagina_Medicos.html)
        // =====================================================================
        public async Task<Resultado> ObtenerMedicoAsync(int idMedico)
        {
            var medico = await _context.Medicos.FirstOrDefaultAsync(m => m.IdMedico == idMedico);
            if (medico == null)
                return Resultado.NoEncontrado(new { mensaje = "Médico no encontrado." });

            var pacientes = await _context.PacienteMedicos
                .Where(pm => pm.IdMedico == idMedico)
                .Select(pm => new
                {
                    pm.IdUsuario,
                    NombrePaciente = $"{pm.IdUsuarioNavigation!.IdPersonaNavigation!.Nombre} {pm.IdUsuarioNavigation.IdPersonaNavigation.Paterno} {pm.IdUsuarioNavigation.IdPersonaNavigation.Materno}",
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

            var lista = pacientes.Select(p => new
            {
                p.IdUsuario,
                p.NombrePaciente,
                UltimoAnalisis = p.UltimoRegistro == null ? null : new
                {
                    p.UltimoRegistro.ValorHemoglobina,
                    Fecha = p.UltimoRegistro.FechaAnalisis.ToString("yyyy-MM-dd"),
                    EstadoSalud = Estado(p.UltimoRegistro.ValorHemoglobina, p.UltimoRegistro.MinimoReferencia, p.UltimoRegistro.MaximoReferencia)
                }
            }).ToList();

            return Resultado.Ok(lista);
        }

        private static string Estado(decimal valor, decimal min, decimal max) =>
            valor < min ? "Anemia" : valor > max ? "Poliglobulia" : "Estable";

        // =====================================================================
        // ADMINISTRADOR (Pagina_Administrador.html)
        // =====================================================================
        public async Task<Resultado> ObtenerAdministradorAsync(int idAdministrador)
        {
            var admin = await _context.Administradors
                .Include(a => a.IdPersonaNavigation)
                .FirstOrDefaultAsync(a => a.IdAdministrador == idAdministrador);

            if (admin == null)
                return Resultado.NoEncontrado(new { mensaje = "Administrador no encontrado." });

            var pacientes = await _context.Usuarios
                .Select(u => new
                {
                    u.IdUsuario,
                    datosPersonales = new
                    {
                        u.IdPersonaNavigation!.Nombre,
                        u.IdPersonaNavigation.Paterno,
                        u.IdPersonaNavigation.Materno,
                        FechaNacimiento = u.IdPersonaNavigation.IdFechaNacimientoNavigation!.FechaDeNacimiento.HasValue
                            ? u.IdPersonaNavigation.IdFechaNacimientoNavigation.FechaDeNacimiento.Value.ToString("yyyy-MM-dd")
                            : null,
                        Genero = u.IdPersonaNavigation.IdGeneroNavigation.Nombre,
                        Correo = u.IdPersonaNavigation.IdCorreoElectronicoNavigation!.CorreoElectronico
                    },
                    TipoSangre = u.IdTipoSangreNavigation!.TipoDeSangre,
                    historialHemoglobina = u.NivelHemoglobinas.Select(nh => new
                    {
                        nh.IdNivel,
                        nh.ValorHemoglobina,
                        nh.Temperatura,
                        FechaAnalisis = nh.FechaAnalisis.ToString("yyyy-MM-dd"),
                        RangoReferencia = new
                        {
                            nh.IdRangoHemoglobinaNavigation.ValorMin,
                            nh.IdRangoHemoglobinaNavigation.ValorMax,
                            nh.Temperatura
                        }
                    }),
                    medicosAsignados = u.PacienteMedicos.Select(pm => new
                    {
                        pm.IdMedico,
                        NombreMedico = $"Dr(a). {pm.IdMedicoNavigation!.IdPersonaNavigation!.Nombre} {pm.IdMedicoNavigation.IdPersonaNavigation.Paterno} {pm.IdMedicoNavigation.IdPersonaNavigation.Materno}"
                    })
                })
                .ToListAsync();

            var medicos = await _context.Medicos
                .Select(m => new
                {
                    m.IdMedico,
                    datosPersonales = new
                    {
                        m.IdPersonaNavigation!.Nombre,
                        m.IdPersonaNavigation.Paterno,
                        m.IdPersonaNavigation.Materno,
                        FechaNacimiento = m.IdPersonaNavigation.IdFechaNacimientoNavigation!.FechaDeNacimiento.HasValue
                            ? m.IdPersonaNavigation.IdFechaNacimientoNavigation.FechaDeNacimiento.Value.ToString("yyyy-MM-dd")
                            : null,
                        Genero = m.IdPersonaNavigation.IdGeneroNavigation.Nombre,
                        Correo = m.IdPersonaNavigation.IdCorreoElectronicoNavigation!.CorreoElectronico
                    },
                    especialidades = m.MedicoEspecialidads.Select(me => me.IdEspecialidadNavigation!.Nombre),
                    totalPacientesACargo = _context.PacienteMedicos.Count(pm => pm.IdMedico == m.IdMedico)
                })
                .ToListAsync();

            // Alertas de hemoglobina baja: análisis por debajo del mínimo del rango con el que se registraron.
            int alertas = await _context.NivelHemoglobinas.CountAsync(nh =>
                nh.ValorHemoglobina < nh.IdRangoHemoglobinaNavigation.ValorMin);

            var p = admin.IdPersonaNavigation;
            return Resultado.Ok(new
            {
                nombreAdmin = $"{p!.Nombre} {p.Paterno} {p.Materno}",
                metricasGlobales = new
                {
                    totalPacientes = pacientes.Count,
                    totalMedicos = medicos.Count,
                    alertasRiesgo = alertas
                },
                pacientes,
                medicos
            });
        }
    }
}
