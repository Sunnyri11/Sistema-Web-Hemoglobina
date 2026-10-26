using Microsoft.Extensions.Options;
using SistemaHBAPI.Configuracion;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace SistemaHBAPI.Services.Correo
{
    /// <summary>Resultado del envío por Brevo.</summary>
    public sealed record RespuestaEnvio(bool Exitoso, int Codigo, string Detalle, bool FaltaApiKey = false);

    public interface IEmailService
    {
        /// <summary>Envía un correo HTML (con un PDF adjunto opcional) por la API web de Brevo.</summary>
        Task<RespuestaEnvio> EnviarAsync(
            string destino, string nombreDestino, string asunto, string html,
            byte[]? adjunto = null, string? nombreAdjunto = null);
    }

    /// <summary>
    /// Envío por la API web de Brevo (HTTPS, puerto 443). Render gratis bloquea SMTP, por eso no se usa MailKit.
    /// La API key sigue leyéndose de EmailSettings:Password.
    /// </summary>
    public sealed class EmailService : IEmailService
    {
        private readonly HttpClient _http;
        private readonly EmailOptions _opciones;
        private readonly ILogger<EmailService> _logger;

        public EmailService(HttpClient http, IOptions<EmailOptions> opciones, ILogger<EmailService> logger)
        {
            _http = http;
            _opciones = opciones.Value;
            _logger = logger;
        }

        public async Task<RespuestaEnvio> EnviarAsync(
            string destino, string nombreDestino, string asunto, string html,
            byte[]? adjunto = null, string? nombreAdjunto = null)
        {
            if (string.IsNullOrWhiteSpace(_opciones.Password))
                return new RespuestaEnvio(false, StatusCodes.Status400BadRequest, "No se encontró la API Key de Brevo.", FaltaApiKey: true);

            var payload = new Dictionary<string, object>
            {
                ["sender"] = new { name = _opciones.SenderName, email = _opciones.SenderEmail },
                ["to"] = new[] { new { email = destino, name = nombreDestino } },
                ["subject"] = asunto,
                ["htmlContent"] = html
            };

            if (adjunto != null)
            {
                payload["attachment"] = new[] { new { content = Convert.ToBase64String(adjunto), name = nombreAdjunto ?? "adjunto.pdf" } };
            }

            using var request = new HttpRequestMessage(HttpMethod.Post, _opciones.ApiUrl);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            request.Headers.TryAddWithoutValidation("api-key", _opciones.Password);
            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            var respuesta = await _http.SendAsync(request);
            var cuerpo = await respuesta.Content.ReadAsStringAsync();

            if (!respuesta.IsSuccessStatusCode)
                _logger.LogWarning("Brevo respondió {Codigo}: {Cuerpo}", (int)respuesta.StatusCode, cuerpo);

            return new RespuestaEnvio(respuesta.IsSuccessStatusCode, (int)respuesta.StatusCode, cuerpo);
        }
    }
}
