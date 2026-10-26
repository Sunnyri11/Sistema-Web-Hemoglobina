using Microsoft.AspNetCore.Mvc;
using SistemaHBAPI.Services.Correo;
using System.Text.Json;

namespace SistemaHBAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EmailController : ControllerBase
    {
        private readonly IReporteService _reportes;
        private readonly IRecuperacionService _recuperacion;
        private readonly INotificacionesEmailService _notificaciones;

        public EmailController(
            IReporteService reportes,
            IRecuperacionService recuperacion,
            INotificacionesEmailService notificaciones)
        {
            _reportes = reportes;
            _recuperacion = recuperacion;
            _notificaciones = notificaciones;
        }

        [HttpPost("enviar-reporte")]
        public async Task<IActionResult> EnviarReportePDF([FromQuery] int id_usuario, [FromQuery] string correo_electronico) =>
            (await _reportes.EnviarReporteAsync(id_usuario, correo_electronico)).ToActionResult();

        [HttpPost("olvidocontraseña/{correo}")]
        public async Task<IActionResult> Olvidocontraseña(string correo) =>
            (await _recuperacion.SolicitarAsync(correo)).ToActionResult();

        [HttpPost("restablecercontraseña/{correo}/{contraseña}")]
        public async Task<IActionResult> Restablecercontraseña(string correo, string contraseña) =>
            (await _recuperacion.RestablecerAsync(correo, contraseña)).ToActionResult();

        [HttpPost("webhook-brevo")]
        public async Task<IActionResult> RecibirNotificacionesBrevo()
        {
            try
            {
                // Se lee el cuerpo a mano: con AddNewtonsoftJson el binder no sabe construir un JsonElement.
                using var documento = await JsonDocument.ParseAsync(Request.Body);
                await _notificaciones.ProcesarWebhookAsync(documento.RootElement);
                return Ok();
            }
            catch (Exception ex)
            {
                // Brevo reintenta si recibe un error; por eso siempre se responde 200.
                return Ok(new { error = ex.Message });
            }
        }
    }
}
