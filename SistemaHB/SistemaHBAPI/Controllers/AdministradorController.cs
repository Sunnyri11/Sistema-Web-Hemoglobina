using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SistemaHBAPI.Models;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Administrador")]
    public class AdministradorController : Controller
    {
        private readonly SistemaHBContext _context;
        public AdministradorController(SistemaHBContext context)
        {
            _context = context;
        }
        [HttpGet("MisDatos/{idpaciente}")]
        public async Task<IActionResult> MisDatos([FromRoute] int idpaciente)
        {
            try
            {
                var administrador = await _context.Administradors.FirstOrDefaultAsync(e => e.IdAdministrador == idpaciente);

                if (administrador == null)
                {
                    return BadRequest(new { mensaje = "La persona existe, pero no está configurada como paciente" });
                }
                var usuario = await _context.Personas.FirstOrDefaultAsync(e => e.IdPersona == administrador.IdPersona);
                var resultado = new
                {
                    Administrador = administrador,
                    Usuario = usuario
                };
                return Ok(resultado);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Error interno en el servidor", detalle = ex.Message });
            }
        }
    }
}
