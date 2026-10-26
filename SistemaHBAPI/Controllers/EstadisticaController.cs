using Microsoft.AspNetCore.Mvc;
using SistemaHBAPI.Services.Datos;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class EstadisticaController : ControllerBase
    {
        private readonly IRangoHemoglobinaService _rangos;

        public EstadisticaController(IRangoHemoglobinaService rangos)
        {
            _rangos = rangos;
        }

        [HttpGet("historial")]
        public async Task<IActionResult> Historial() =>
            (await _rangos.HistorialGlobalAsync()).ToActionResult();
    }
}
