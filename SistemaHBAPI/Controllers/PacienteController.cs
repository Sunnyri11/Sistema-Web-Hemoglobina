using BibliotecaSistemaHB;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaHBAPI.Services.Usuarios;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Paciente")]
    public class PacienteController : ControllerBase
    {
        private readonly IPacienteService _pacientes;

        public PacienteController(IPacienteService pacientes)
        {
            _pacientes = pacientes;
        }

        [HttpGet("MisDatos/{idpaciente}")]
        public async Task<IActionResult> MisDatos([FromRoute] int idpaciente) =>
            (await _pacientes.MisDatosAsync(idpaciente)).ToActionResult();

        [HttpGet("mihistorial/{id}")]
        public async Task<IActionResult> MiHistorial([FromRoute] int id) =>
            (await _pacientes.MiHistorialAsync(id)).ToActionResult();

        [HttpPut("editarpaciente/{id}")]
        public async Task<IActionResult> EditarPerfil(int id, [FromBody] EditPerfilDto model) =>
            (await _pacientes.EditarPerfilAsync(id, model)).ToActionResult();

        [HttpGet("mismedicos/{id}")]
        public async Task<IActionResult> MisMedicos([FromRoute] int id) =>
            (await _pacientes.MisMedicosAsync(id)).ToActionResult();
    }
}
