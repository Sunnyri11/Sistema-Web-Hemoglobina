using BibliotecaSistemaHB;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SistemaHBAPI.Extensions;
using SistemaHBAPI.Services.Usuarios;

namespace SistemaHBAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Medico")]
    public class MedicoController : ControllerBase
    {
        private readonly IMedicoService _medicos;

        public MedicoController(IMedicoService medicos)
        {
            _medicos = medicos;
        }

        [HttpGet("MisDatos/{idmedico}")]
        public async Task<IActionResult> MisDatos([FromRoute] int idmedico) =>
            (await _medicos.MisDatosAsync(idmedico)).ToActionResult();

        [HttpGet("mis-pacientes/{idmedico}")]
        public async Task<IActionResult> ObtenerMisPacientes(int idmedico) =>
            (await _medicos.MisPacientesAsync(idmedico)).ToActionResult();

        [HttpGet("pacientes/{idusuario}")]
        public async Task<IActionResult> Pacientes(int idusuario) =>
            (await _medicos.PacientesDisponiblesAsync(idusuario)).ToActionResult();

        [HttpPost("añadir-paciente/{idUsuario}")]
        public async Task<IActionResult> AñadirPacienteRelacion(int idUsuario)
        {
            if (User.ObtenerIdEntidad() is not int idMedico)
                return Unauthorized(new { mensaje = "No se pudo identificar al médico desde la sesión actual." });

            return (await _medicos.AnadirPacienteAsync(idMedico, idUsuario)).ToActionResult();
        }

        [HttpDelete("borrar-paciente/{idUsuario}")]
        public async Task<IActionResult> BorrarPacienteRelacion(int idUsuario)
        {
            if (User.ObtenerIdEntidad() is not int idMedico)
                return Unauthorized(new { mensaje = "No se pudo identificar al médico desde la sesión actual." });

            return (await _medicos.BorrarPacienteAsync(idMedico, idUsuario)).ToActionResult();
        }

        [HttpPut("editarmedico/{id}")]
        public async Task<IActionResult> EditarPerfil(int id, [FromBody] EditPerfilDto model) =>
            (await _medicos.EditarPerfilAsync(id, model)).ToActionResult();
    }
}
