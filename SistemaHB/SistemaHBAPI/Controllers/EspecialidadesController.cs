using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SistemaHBAPI.Models;
using System.Threading.Tasks;
using System.Linq;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class EspecialidadesController : ControllerBase
    {
        private readonly SistemaHBContext _context;

        public EspecialidadesController(SistemaHBContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetEspecialidades()
        {
            try
            {
                var especialidades = await _context.Especialidades
                    .Select(d => new {
                        idEspecialidad = d.IdEspecialidad,
                        nombre = d.Nombre ?? "Sin Nombre" // Evita valores nulos en el JSON de salida
                    })
                    .ToListAsync();

                if (especialidades == null || !especialidades.Any())
                {
                    // Devolvemos una lista vacía estructurada en lugar de un null
                    return Ok(new System.Collections.ArrayList());
                }

                return Ok(especialidades);
            }
            catch (System.Exception ex)
            {
                // Captura fallos físicos de la base de datos en Aiven y devuelve una respuesta controlada
                return StatusCode(500, new
                {
                    mensaje = "Error al recuperar el catálogo de especialidades médicas.",
                    detalle = ex.Message
                });
            }
        }
    }
}
