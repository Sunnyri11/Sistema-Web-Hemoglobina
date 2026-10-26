using BibliotecaSistemaHB;
using Microsoft.AspNetCore.Mvc;
using SistemaHBAPI.Services.Usuarios;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RegistroController : ControllerBase
    {
        private readonly IRegistroService _registro;

        public RegistroController(IRegistroService registro)
        {
            _registro = registro;
        }

        [HttpPost("usuario")]
        public async Task<IActionResult> RegistrarPaciente([FromBody] REGISTROFORMCLS model) =>
            (await _registro.RegistrarAsync(model)).ToActionResult();
    }
}
