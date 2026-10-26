using Microsoft.AspNetCore.Mvc;
using SistemaHBAPI.Services.Datos;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class GeografiaController : ControllerBase
    {
        private readonly ICatalogoService _catalogo;

        public GeografiaController(ICatalogoService catalogo)
        {
            _catalogo = catalogo;
        }

        // Primer SELECT del formulario.
        [HttpGet("departamentos")]
        public async Task<IActionResult> GetDepartamentos() =>
            (await _catalogo.DepartamentosAsync()).ToActionResult();

        // Ciudades/provincias del departamento elegido.
        [HttpGet("provincias/{idDepartamento}")]
        public async Task<IActionResult> GetProvincias(int idDepartamento) =>
            (await _catalogo.ProvinciasAsync(idDepartamento)).ToActionResult();
    }
}
