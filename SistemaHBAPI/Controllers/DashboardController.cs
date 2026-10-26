using BibliotecaSistemaHB;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaHBAPI.Extensions;
using SistemaHBAPI.Services.Datos;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DashboardController : ControllerBase
    {
        private readonly IDashboardService _dashboard;

        public DashboardController(IDashboardService dashboard)
        {
            _dashboard = dashboard;
        }

        // Pantalla del paciente (Monitoreo.html): historial + análisis de Walle-HB.
        [HttpGet("paciente")]
        public async Task<IActionResult> ObtenerDatosPaciente()
        {
            if (User.ObtenerIdEntidad() is not int id)
                return Unauthorized(new { mensaje = "Token inválido o expirado." });

            return (await _dashboard.ObtenerPacienteAsync(id)).ToActionResult();
        }

        [HttpPost("guardarAnalisis/{idObservacion:int}")]
        public async Task<IActionResult> GuardarAnalisis([FromRoute] int idObservacion, [FromBody] RequestAnalisis dto)
        {
            if (User.ObtenerIdEntidad() is not int id)
                return Unauthorized(new { mensaje = "Token inválido o expirado." });

            return (await _dashboard.GuardarAnalisisAsync(id, idObservacion, dto)).ToActionResult();
        }

        // Pantalla del médico (Pagina_Medicos.html).
        [HttpGet("medico")]
        public async Task<IActionResult> ObtenerDatosMedico()
        {
            if (User.ObtenerIdEntidad() is not int id)
                return Unauthorized(new { mensaje = "Token inválido." });

            return (await _dashboard.ObtenerMedicoAsync(id)).ToActionResult();
        }

        // Pantalla del administrador (Pagina_Administrador.html).
        [HttpGet("administrador")]
        public async Task<IActionResult> ObtenerDatosAdministrador()
        {
            if (User.ObtenerIdEntidad() is not int id)
                return Unauthorized(new { mensaje = "Token inválido." });

            return (await _dashboard.ObtenerAdministradorAsync(id)).ToActionResult();
        }
    }
}
