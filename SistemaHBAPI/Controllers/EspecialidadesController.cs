using Microsoft.AspNetCore.Mvc;
using SistemaHBAPI.Services.Datos;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class EspecialidadesController : ControllerBase
    {
        private readonly ICatalogoService _catalogo;

        public EspecialidadesController(ICatalogoService catalogo)
        {
            _catalogo = catalogo;
        }

        [HttpGet]
        public async Task<IActionResult> GetEspecialidades() =>
            (await _catalogo.EspecialidadesAsync()).ToActionResult();
    }
}
