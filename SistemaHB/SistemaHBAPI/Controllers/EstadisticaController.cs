using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SistemaHBAPI.Models;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class EstadisticaController : Controller
    {
        private readonly SistemaHBContext _context;
        public EstadisticaController(SistemaHBContext _context)
        {
            this._context = _context;
        }

        [HttpGet("historial")]
        public async Task<IActionResult> Historial()
        {
            try
            {

                var historial = await _context.NivelHemoglobinas
                    .Include(n => n.IdRangoHemoglobinaNavigation)
                        .ThenInclude(r => r.IdEdadNavigation)
                    .Include(n => n.IdRangoHemoglobinaNavigation)
                        .ThenInclude(r => r.IdCiudadNavigation)
                    .Include(n => n.IdRangoHemoglobinaNavigation)
                        .ThenInclude(r => r.IdGeneroNavigation)
                    .Include(n => n.IdRangoHemoglobinaNavigation)
                        .ThenInclude(r => r.IdObservacionNavigation)
                    .ToListAsync();

                return Ok(historial);
            }
            catch
            {
                return BadRequest();
            }
        }
    }
}
