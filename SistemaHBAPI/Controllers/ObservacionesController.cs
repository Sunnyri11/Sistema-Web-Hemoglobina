using Microsoft.AspNetCore.Mvc;
using SistemaHBAPI.Services.Datos;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ObservacionesController : ControllerBase
    {
        private readonly ICatalogoService _catalogo;

        public ObservacionesController(ICatalogoService catalogo)
        {
            _catalogo = catalogo;
        }

        [HttpGet("observacionesclinicas")]
        public async Task<IActionResult> Observacionesclinicas() =>
            (await _catalogo.ObservacionesClinicasAsync()).ToActionResult();
    }
}
