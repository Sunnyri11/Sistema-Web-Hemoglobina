using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SistemaHBAPI.Models;
using System.Threading.Tasks;
using System.Linq;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class GeografiaController : ControllerBase
    {
        private readonly SistemaHBContext _context;

        public GeografiaController(SistemaHBContext context)
        {
            _context = context;
        }

        // 1. Obtener todos los departamentos para cargar el primer SELECT
        [HttpGet("departamentos")]
        public async Task<IActionResult> GetDepartamentos()
        {
            try
            {
                var departamentos = await _context.Departamentos
                    .Select(d => new {
                        idDepartamento = d.IdDepartamento,
                        nombre = d.Departamento1 ?? "Sin Nombre" // Evita nulos si la fila está incompleta
                    })
                    .ToListAsync();

                if (departamentos == null || !departamentos.Any())
                {
                    // Devolvemos una lista vacía en lugar de null para evitar que el .map() de JS truene
                    return Ok(new System.Collections.ArrayList());
                }

                return Ok(departamentos);
            }
            catch (System.Exception ex)
            {
                return StatusCode(500, new
                {
                    mensaje = "Error al recuperar los departamentos desde la base de datos.",
                    detalle = ex.Message
                });
            }
        }

        // 2. Obtener las provincias/ciudades filtradas por el departamento seleccionado
        [HttpGet("provincias/{idDepartamento}")]
        public async Task<IActionResult> GetProvincias(int idDepartamento)
        {
            // Validación preventiva de ID lógico
            if (idDepartamento <= 0)
            {
                return BadRequest(new { mensaje = "El ID del departamento proporcionado no es válido." });
            }

            try
            {
                // Validar primero si el departamento existe en producción (Aiven)
                var deptoExiste = await _context.Departamentos.AnyAsync(d => d.IdDepartamento == idDepartamento);
                if (!deptoExiste)
                {
                    return NotFound(new { mensaje = $"El departamento con ID {idDepartamento} no existe en el sistema." });
                }

                var provincias = await _context.Ciudads
                    .Where(c => c.IdDepartamento == idDepartamento)
                    .Select(c => new {
                        idCiudad = c.IdCiudad,
                        nombre = c.Nombre ?? "Sin Nombre",
                        altitud = c.Altitud
                    })
                    .ToListAsync();

                return Ok(provincias);
            }
            catch (System.Exception ex)
            {
                return StatusCode(500, new
                {
                    mensaje = "Error al recuperar las provincias/ciudades desde la base de datos.",
                    detalle = ex.Message
                });
            }
        }
    }
}
