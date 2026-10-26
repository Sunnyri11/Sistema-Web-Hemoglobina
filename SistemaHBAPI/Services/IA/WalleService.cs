using BibliotecaSistemaHB;
using BibliotecaSistemaHB.Walle;
using Microsoft.Extensions.Options;
using SistemaHBAPI.Configuracion;
using System.Net;
using System.Net.Http.Json;

namespace SistemaHBAPI.Services.IA
{
    public interface IWalleService
    {
        /// <summary>
        /// Envía a Walle-HB (Render) el último dato y el historial completo del paciente y devuelve
        /// su análisis. El historial debe venir ordenado del más nuevo al más antiguo.
        /// </summary>
        Task<AnalisisIaDto> AnalizarAsync(
            int idUsuario, int idGenero, double altitud, int edad,
            IReadOnlyList<RegistroHemoglobinaDto> historial);
    }

    public sealed class WalleService : IWalleService
    {
        private readonly HttpClient _http;
        private readonly WalleOptions _opciones;
        private readonly ILogger<WalleService> _logger;

        public WalleService(HttpClient http, IOptions<WalleOptions> opciones, ILogger<WalleService> logger)
        {
            _http = http;
            _opciones = opciones.Value;
            _logger = logger;
        }

        public async Task<AnalisisIaDto> AnalizarAsync(
            int idUsuario, int idGenero, double altitud, int edad,
            IReadOnlyList<RegistroHemoglobinaDto> historial)
        {
            if (historial.Count == 0) return new AnalisisIaDto();

            var ultimo = historial[0];

            // Último dato + historial completo: Walle-HB exige ambos y aprende de cada registro.
            var payload = new
            {
                id_usuario = idUsuario,
                id_genero = idGenero,
                altitud,
                edad,
                ultimo_dato = Mapear(ultimo),
                historial = historial.Select(Mapear).ToList()
            };

            try
            {
                var respuesta = await _http.PostAsJsonAsync(_opciones.Url, payload);

                if (respuesta.IsSuccessStatusCode)
                {
                    var ia = await respuesta.Content.ReadFromJsonAsync<RespuestaIaModel>();
                    return ia == null ? new AnalisisIaDto() : Convertir(ia);
                }

                _logger.LogWarning("Walle-HB respondió {Codigo}.", (int)respuesta.StatusCode);

                if (respuesta.StatusCode == HttpStatusCode.NotFound)
                {
                    return new AnalisisIaDto
                    {
                        Estado = "Error 404",
                        Alertas = "❌ La ruta en el servidor de Render no coincide con el endpoint base."
                    };
                }

                // 422 = faltan ultimo_dato/historial; 503 = la IA todavía no tiene un modelo entrenado.
                return new AnalisisIaDto
                {
                    Estado = $"Error {(int)respuesta.StatusCode}",
                    Alertas = $"⚠️ Walle-HB respondió {(int)respuesta.StatusCode}. Intenta nuevamente en unos segundos."
                };
            }
            catch (Exception ex)
            {
                // Render gratis duerme tras un rato sin uso (~50 s para despertar): basta con refrescar.
                _logger.LogWarning(ex, "No se pudo contactar a Walle-HB.");
                return new AnalisisIaDto
                {
                    Estado = "Procesando...",
                    Alertas = "⚠️ El motor de Inteligencia Artificial está despertando. Por favor refresca la página en unos segundos.",
                    Recomendaciones = new[] { "• Conexión establecida, esperando respuesta del microservicio analítico." }
                };
            }
        }

        private static object Mapear(RegistroHemoglobinaDto r) => new
        {
            valor_hemoglobina = Convert.ToDouble(r.ValorHemoglobina),
            valor_min = Convert.ToDouble(r.ValorMin),
            valor_max = Convert.ToDouble(r.ValorMax),
            temperatura = Convert.ToDouble(r.Temperatura),
            fecha = r.Fecha
        };

        private static AnalisisIaDto Convertir(RespuestaIaModel ia)
        {
            // FastAPI envía el estado como arreglo: ["Estable"].
            string estado = ia.Estado is { Length: > 0 } ? ia.Estado[0] : "Estable";
            if (string.IsNullOrEmpty(estado) || estado.Length <= 1) estado = "Estable";

            return new AnalisisIaDto
            {
                Estado = estado,
                Alertas = ia.Alertas is { Length: > 0 } ? ia.Alertas[0] : "",
                Recomendaciones = ia.Recomendaciones ?? Array.Empty<string>(),
                Prediccion = ia.Prediccion
            };
        }
    }
}
