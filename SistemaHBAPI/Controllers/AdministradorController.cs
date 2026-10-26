using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaHBAPI.Services.Usuarios;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Administrador")]
    public class AdministradorController : ControllerBase
    {
        private readonly IAdministradorService _administradores;

        public AdministradorController(IAdministradorService administradores)
        {
            _administradores = administradores;
        }

        [HttpGet("MisDatos/{idpaciente}")]
        public async Task<IActionResult> MisDatos([FromRoute] int idpaciente) =>
            (await _administradores.MisDatosAsync(idpaciente)).ToActionResult();
    }
}
