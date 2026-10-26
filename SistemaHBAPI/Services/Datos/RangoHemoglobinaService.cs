using BibliotecaSistemaHB.Utilidades;
using Microsoft.EntityFrameworkCore;
using SistemaHBAPI.Models;

namespace SistemaHBAPI.Services.Datos
{
    public interface IRangoHemoglobinaService
    {
        Task<Resultado> TodosLosRangosAsync();
        Task<Resultado> MiRangoAsync(int idUsuario);
        Task<Resultado> HistorialGlobalAsync();
    }

    /// <summary>Consultas de rangos de referencia y estadística global.</summary>
    public sealed class RangoHemoglobinaService : IRangoHemoglobinaService
    {
        private readonly SistemaHBContext _context;

        public RangoHemoglobinaService(SistemaHBContext context)
        {
            _context = context;
        }

        public async Task<Resultado> TodosLosRangosAsync()
        {
            try
            {
                var rangos = await _context.RangoHemoglobinas
                    .Select(r => new RangoHemoglobina
                    {
                        IdRango = r.IdRango,
                        IdCiudad = r.IdCiudad,
                        IdEdad = r.IdEdad,
                        ValorMin = r.ValorMin,
                        ValorMax = r.ValorMax,
                        IdGenero = r.IdGenero
                    })
                    .ToListAsync();

                return Resultado.Ok(rangos);
            }
            catch
            {
                return Resultado.BadRequest();
            }
        }

        public async Task<Resultado> MiRangoAsync(int idUsuario)
        {
            try
            {
                var usuario = await _context.Usuarios
                    .Include(u => u.IdPersonaNavigation).ThenInclude(p => p!.IdFechaNacimientoNavigation)
                    .FirstOrDefaultAsync(u => u.IdUsuario == idUsuario);

                if (usuario == null) return Resultado.NoEncontrado("Usuario no encontrado.");

                var persona = usuario.IdPersonaNavigation;
                if (persona == null) return Resultado.NoEncontrado("Datos de la persona no encontrados.");

                var nacimiento = persona.IdFechaNacimientoNavigation?.FechaDeNacimiento;
                if (nacimiento == null) return Resultado.BadRequest("La persona no posee una fecha de nacimiento válida.");

                int edad = CalculadoraEdad.Calcular(nacimiento.Value);

                var edadPredeterminada = await _context.Edades.FirstOrDefaultAsync(e => e.Edad == edad);
                if (edadPredeterminada == null)
                    return Resultado.NoEncontrado($"No se encontró una configuración de rango para la edad de {edad} años.");

                // Rango base del usuario: observación NULL = patrón sin patología.
                var rangoActual = await _context.RangoHemoglobinas.FirstOrDefaultAsync(r =>
                    r.IdEdad == edadPredeterminada.IdEdad &&
                    r.IdGenero == persona.IdGenero &&
                    r.IdCiudad == persona.IdCiudad &&
                    r.IdObservacion == null);

                if (rangoActual == null)
                    return Resultado.NoEncontrado("No se encontró un rango de hemoglobina configurado para las condiciones geográficas y biológicas de este usuario.");

                var historial = await _context.NivelHemoglobinas
                    .Where(n => n.IdUsuario == idUsuario)
                    .Include(n => n.IdRangoHemoglobinaNavigation)
                    .Select(n => new
                    {
                        IdNivel = n.IdNivel,
                        ValorHemoglobina = n.ValorHemoglobina,
                        Temperatura = n.Temperatura,
                        FechaAnalisis = n.FechaAnalisis,
                        // Rango con el que se guardó el análisis en su momento.
                        RangoReferencia = new
                        {
                            IdRango = n.IdRangoHemoglobinaNavigation.IdRango,
                            ValorMinimo = n.IdRangoHemoglobinaNavigation.ValorMin,
                            ValorMaximo = n.IdRangoHemoglobinaNavigation.ValorMax
                        },
                        // Rango vigente hoy, para comparar si cambió la ciudad, la edad, etc.
                        RangoActualDelUsuario = new
                        {
                            IdRango = rangoActual.IdRango,
                            ValorMinimo = rangoActual.ValorMin,
                            ValorMaximo = rangoActual.ValorMax
                        },
                        EdadActualCalculada = edad
                    })
                    .ToListAsync();

                return Resultado.Ok(historial);
            }
            catch (Exception ex)
            {
                return Resultado.ErrorInterno($"Error interno en el servidor central: {ex.Message}");
            }
        }

        public async Task<Resultado> HistorialGlobalAsync()
        {
            try
            {
                var historial = await _context.NivelHemoglobinas
                    .Include(n => n.IdRangoHemoglobinaNavigation).ThenInclude(r => r.IdEdadNavigation)
                    .Include(n => n.IdRangoHemoglobinaNavigation).ThenInclude(r => r.IdCiudadNavigation)
                    .Include(n => n.IdRangoHemoglobinaNavigation).ThenInclude(r => r.IdGeneroNavigation)
                    .Include(n => n.IdRangoHemoglobinaNavigation).ThenInclude(r => r.IdObservacionNavigation)
                    .ToListAsync();

                return Resultado.Ok(historial);
            }
            catch
            {
                return Resultado.BadRequest();
            }
        }
    }
}
