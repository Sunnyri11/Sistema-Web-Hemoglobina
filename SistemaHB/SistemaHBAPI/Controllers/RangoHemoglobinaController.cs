using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SistemaHBAPI.Models;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RangoHemoglobinaController : Controller
    {
        private readonly SistemaHBContext _context;
        public RangoHemoglobinaController(SistemaHBContext _context)
        {
            this._context = _context;
        }

        [HttpGet("rangohemo")]
        public async Task<IActionResult> RangoHemo()
        {
            try
            {
                var rangohemo = await (from rang in _context.RangoHemoglobinas
                                 select new RangoHemoglobina
                                 {
                                     IdRango=rang.IdRango,
                                     IdCiudad=rang.IdCiudad,
                                     IdEdad=rang.IdEdad,
                                     ValorMin=rang.ValorMin,
                                     ValorMax=rang.ValorMax,
                                     IdGenero=rang.IdGenero,
                                 }).ToListAsync();
                return Ok(rangohemo);
            }
            catch
            {
                return BadRequest();
            }
        }

        [HttpGet("mirango/{id}")]
        public async Task<IActionResult> mirango(int id)
        {
            try
            {
                // 1. Carga optimizada en una sola consulta de base de datos usando Include (Evita consultas en cadena)
                var usuario = await _context.Usuarios
                    .Include(u => u.IdPersonaNavigation)
                        .ThenInclude(p => p.IdFechaNacimientoNavigation)
                    .FirstOrDefaultAsync(u => u.IdUsuario == id);

                if (usuario == null) return NotFound("Usuario no encontrado.");

                var persona = usuario.IdPersonaNavigation;
                if (persona == null) return NotFound("Datos de la persona no encontrados.");

                var fechaNavObj = persona.IdFechaNacimientoNavigation;
                if (fechaNavObj?.FechaDeNacimiento == null) return BadRequest("La persona no posee una fecha de nacimiento válida.");

                // 2. Cálculo exacto de la edad
                var hoy = DateOnly.FromDateTime(DateTime.Today);
                DateOnly fechaNacimiento = fechaNavObj.FechaDeNacimiento.Value;

                int edad = hoy.Year - fechaNacimiento.Year;
                if (fechaNacimiento > hoy.AddYears(-edad)) edad--;

                // 3. Buscar el ID de la edad correspondiente
                var edad_pred = await _context.Edades.FirstOrDefaultAsync(e => e.Edad == edad);
                if (edad_pred == null) return NotFound($"No se encontró una configuración de rango para la edad de {edad} años.");

                // 4. Buscar el rango de hemoglobina BASE/ACTUAL que le corresponde a este usuario (Por defecto id_observacion IS NULL)
                var rangoCorrespondiente = await _context.RangoHemoglobinas.FirstOrDefaultAsync(r =>
                    r.IdEdad == edad_pred.IdEdad &&
                    r.IdGenero == persona.IdGenero &&
                    r.IdCiudad == persona.IdCiudad &&
                    r.IdObservacion == null); // Asegura traer el patrón biológico limpio por defecto si no se especifica patología

                if (rangoCorrespondiente == null)
                    return NotFound("No se encontró un rango de hemoglobina configurado para las condiciones geográficas y biológicas de este usuario.");

                // 5. Historial de niveles utilizando navegación de propiedades (Más rápido que un JOIN explícito en EF Core)
                var historialNiveles = await _context.NivelHemoglobinas
                    .Where(n => n.IdUsuario == id)
                    .Include(n => n.IdRangoHemoglobinaNavigation) // Carga el rango con el que se guardó en su momento
                    .Select(n => new
                    {
                        IdNivel = n.IdNivel,
                        ValorHemoglobina = n.ValorHemoglobina,
                        Temperatura = n.Temperatura,
                        FechaAnalisis = n.FechaAnalisis,
                        // Rango histórico guardado en la fila del análisis
                        RangoReferencia = new
                        {
                            IdRango = n.IdRangoHemoglobinaNavigation.IdRango,
                            ValorMinimo = n.IdRangoHemoglobinaNavigation.ValorMin,
                            ValorMaximo = n.IdRangoHemoglobinaNavigation.ValorMax
                        },
                        // Rango actual calculado en tiempo real (Paso 4) para comparar en el Frontend si hubo cambios geográficos
                        RangoActualDelUsuario = new
                        {
                            IdRango = rangoCorrespondiente.IdRango,
                            ValorMinimo = rangoCorrespondiente.ValorMin,
                            ValorMaximo = rangoCorrespondiente.ValorMax
                        },
                        EdadActualCalculada = edad
                    })
                    .ToListAsync();

                return Ok(historialNiveles);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error interno en el servidor central: {ex.Message}");
            }
        }

    }
}
