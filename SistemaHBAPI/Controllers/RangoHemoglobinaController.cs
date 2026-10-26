using Microsoft.AspNetCore.Mvc;
using SistemaHBAPI.Services.Datos;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RangoHemoglobinaController : ControllerBase
    {
        private readonly IRangoHemoglobinaService _rangos;

        public RangoHemoglobinaController(IRangoHemoglobinaService rangos)
        {
            _rangos = rangos;
        }

        [HttpGet("rangohemo")]
        public async Task<IActionResult> RangoHemo() =>
            (await _rangos.TodosLosRangosAsync()).ToActionResult();

        [HttpGet("mirango/{id}")]
        public async Task<IActionResult> MiRango(int id) =>
            (await _rangos.MiRangoAsync(id)).ToActionResult();
    }
}
