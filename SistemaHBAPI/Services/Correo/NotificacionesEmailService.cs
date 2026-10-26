using BibliotecaSistemaHB;
using Microsoft.AspNetCore.SignalR;
using System.Text.Json;

namespace SistemaHBAPI.Services.Correo
{
    public interface INotificacionesEmailService
    {
        /// <summary>Procesa el webhook de Brevo y avisa por SignalR (solo para los correos de "Reporte").</summary>
        Task ProcesarWebhookAsync(JsonElement payload);
    }

    public sealed class NotificacionesEmailService : INotificacionesEmailService
    {
        private readonly IHubContext<NotificacionesHub> _hub;

        public NotificacionesEmailService(IHubContext<NotificacionesHub> hub)
        {
            _hub = hub;
        }

        public async Task ProcesarWebhookAsync(JsonElement payload)
        {
            string evento = Leer(payload, "event");
            string email = Leer(payload, "email");
            string asunto = Leer(payload, "subject");

            if (string.IsNullOrEmpty(asunto) || !asunto.Contains("Reporte", StringComparison.OrdinalIgnoreCase))
                return;

            string? mensaje = evento switch
            {
                "delivered" => $"¡Buenas noticias! El reporte clínico ya llegó a la bandeja de {email}.",
                "opened" => $"El paciente con el correo {email} acaba de abrir y leer su reporte.",
                "hard_bounce" or "soft_bounce" => $"⚠️ Error: El reporte para {email} rebotó. Verifica si el correo existe.",
                _ => null
            };

            if (mensaje == null) return;

            await _hub.Clients.All.SendAsync("RecibirEstadoEmail", new { correo = email, estado = evento, mensaje });
        }

        private static string Leer(JsonElement payload, string propiedad) =>
            payload.TryGetProperty(propiedad, out var valor) ? valor.GetString() ?? "" : "";
    }
}
