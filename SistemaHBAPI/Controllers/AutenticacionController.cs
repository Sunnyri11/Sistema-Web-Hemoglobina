using BibliotecaSistemaHB;
using Microsoft.AspNetCore.Mvc;
using SistemaHBAPI.Services.Autenticacion;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AutenticacionController : ControllerBase
    {
        private readonly IAuthService _auth;

        public AutenticacionController(IAuthService auth)
        {
            _auth = auth;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LOGINFORMCLS model) =>
            (await _auth.LoginAsync(model)).ToActionResult();
    }
}
