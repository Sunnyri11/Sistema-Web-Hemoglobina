using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using SistemaHBAPI.Models;
using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace SistemaHBAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EmailController : Controller
    {
        private readonly IConfiguration _configuration;
        private readonly SistemaHBContext _context;
        private static readonly HttpClient _httpClient = new HttpClient();

        public EmailController(SistemaHBContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [HttpPost("enviar-reporte")]
        public async Task<IActionResult> EnviarReportePDF([FromQuery] int id_usuario, [FromQuery] string correo_electronico)
        {
            if (string.IsNullOrEmpty(correo_electronico))
            {
                return BadRequest(new { mensaje = "El correo electrónico es obligatorio." });
            }

            try
            {
                // 1. Obtener el nombre completo del paciente cruzando las tablas de tu contexto
                var usuarioData = await _context.Usuarios
                    .Include(u => u.IdPersonaNavigation)
                    .FirstOrDefaultAsync(u => u.IdUsuario == id_usuario);

                string nombreCompleto = "Paciente";
                if (usuarioData?.IdPersonaNavigation != null)
                {
                    var p = usuarioData.IdPersonaNavigation;
                    nombreCompleto = $"{p.Nombre} {p.Paterno} {p.Materno}".Trim();
                }

                // 2. Obtener el historial clínico de la base de datos
                var historialCompleto = await _context.NivelHemoglobinas
                    .Where(e => e.IdUsuario == id_usuario)
                    .OrderByDescending(e => e.IdNivel)
                    .ToListAsync();

                if (!historialCompleto.Any())
                {
                    return Ok(new { mensaje = "Sin historial para generar el reporte." });
                }

                int totalRegistros = historialCompleto.Count;
                string ultimoEstado = "Normal (Estable)";
                string colorEstado = "#27ae60";

                // 3. Formatear datos clínicos para el cuerpo del mensaje
                for (int i = 0; i < totalRegistros; i++)
                {
                    var r = historialCompleto[i];
                    double valor = (double)r.ValorHemoglobina;
                    if (valor < 12) { ultimoEstado = "Alerta de Anemia"; colorEstado = "#c0392b"; break; }
                    if (valor > 17) { ultimoEstado = "Alerta de Poliglobulia"; colorEstado = "#d35400"; break; }
                }

                // Estructura visual para el cuerpo del correo
                string cuerpoMensajeEmailHtml = $@"
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;'>
                    <div style='background-color: #0f172a; padding: 20px; text-align: center; color: white;'>
                        <h2 style='margin: 0;'>SISTEMA HB</h2>
                    </div>
                    <div style='padding: 25px; background-color: #ffffff; color: #334155;'>
                        <p>Estimado(a) <strong>{nombreCompleto}</strong>,</p>
                        <p>Adjunto encontrará su reporte clínico de niveles de hemoglobina generado en formato PDF.</p>
                        <div style='background-color: #f8fafc; border-left: 4px solid #2980b9; padding: 15px; margin: 20px 0;'>
                            <p style='margin: 4px 0;'><strong>Total de registros:</strong> {totalRegistros}</p>
                            <p style='margin: 4px 0;'><strong>Último diagnóstico:</strong> <span style='color: {colorEstado}; font-weight: bold;'>{ultimoEstado}</span></p>
                        </div>
                    </div>
                </div>";

                // 4. Construcción dinámica del archivo PDF nativo binario (.pdf) usando QuestPDF
                byte[] pdfBytes;
                using (var streamPDF = new MemoryStream())
                {
                    QuestPDF.Fluent.Document.Create(container =>
                    {
                        container.Page(page =>
                        {
                            page.Size(QuestPDF.Helpers.PageSizes.A4);
                            page.Margin(1, QuestPDF.Infrastructure.Unit.Inch);
                            page.DefaultTextStyle(x => x.FontFamily(QuestPDF.Helpers.Fonts.Lato));

                            page.Header().Background("#0f172a").Padding(15).Text("SISTEMA HB - REPORTE CLÍNICO")
                                .FontColor("#ffffff").FontSize(20).Bold();

                            page.Content().PaddingVertical(20).Column(column =>
                            {
                                column.Item().Text($"Paciente: {nombreCompleto}").FontSize(12).Bold();
                                column.Item().Text($"Correo Electrónico: {correo_electronico}").FontSize(11);
                                column.Item().Text($"Total de Análisis: {totalRegistros}").FontSize(11);

                                column.Item().PaddingTop(20).Table(tabla =>
                                {
                                    tabla.ColumnsDefinition(cols =>
                                    {
                                        cols.RelativeColumn(1.5f);
                                        cols.RelativeColumn(2f);
                                        cols.RelativeColumn(2f);
                                        cols.RelativeColumn(2.5f);
                                    });

                                    tabla.Cell().Background("#2980b9").Padding(8).Text("Secuencia").FontColor("#ffffff").Bold();
                                    tabla.Cell().Background("#2980b9").Padding(8).Text("Fecha").FontColor("#ffffff").Bold();
                                    tabla.Cell().Background("#2980b9").Padding(8).Text("Hemoglobina").FontColor("#ffffff").Bold();
                                    tabla.Cell().Background("#2980b9").Padding(8).Text("Evaluación").FontColor("#ffffff").Bold();

                                    for (int idx = 0; idx < totalRegistros; idx++)
                                    {
                                        var registro = historialCompleto[idx];
                                        double vHemoglobina = (double)registro.ValorHemoglobina;
                                        string eval = "Normal (Estable)";
                                        string colorTexto = "#27ae60";

                                        if (vHemoglobina < 12) { eval = "Alerta de Anemia"; colorTexto = "#c0392b"; }
                                        else if (vHemoglobina > 17) { eval = "Alerta de Poliglobulia"; colorTexto = "#d35400"; }

                                        tabla.Cell().BorderBottom(1, QuestPDF.Infrastructure.Unit.Point).BorderColor("#e2e8f0").Padding(8).Text($"Medición {totalRegistros - idx}");
                                        tabla.Cell().BorderBottom(1, QuestPDF.Infrastructure.Unit.Point).BorderColor("#e2e8f0").Padding(8).Text(registro.FechaAnalisis.ToShortDateString());
                                        tabla.Cell().BorderBottom(1, QuestPDF.Infrastructure.Unit.Point).BorderColor("#e2e8f0").Padding(8).Text($"{vHemoglobina.ToString("F2")} g/dL");
                                        tabla.Cell().BorderBottom(1, QuestPDF.Infrastructure.Unit.Point).BorderColor("#e2e8f0").Padding(8).Text(eval).FontColor(colorTexto).Bold();
                                    }
                                });
                            });
                        });
                    }).GeneratePdf(streamPDF);

                    pdfBytes = streamPDF.ToArray();
                }

                // 5. Convertir el archivo PDF a Base64 para poder mandarlo por el canal Web HTTP (Puerto 443)
                string pdfBase64 = Convert.ToBase64String(pdfBytes);
                string nombreArchivoPdf = $"Reporte_Hemoglobina_Usuario_{id_usuario}.pdf";

                // 6. Construir el objeto JSON requerido por la API Web de Brevo
                var payloadCorreo = new
                {
                    sender = new { name = _configuration["EmailSettings:SenderName"] ?? "Sistema HB", email = _configuration["EmailSettings:SenderEmail"] ?? "sistemashemoglobina@gmail.com" },
                    to = new[] { new { email = correo_electronico, name = nombreCompleto } },
                    subject = $"📋 Reporte de Control de Hemoglobina - {nombreCompleto}",
                    htmlContent = cuerpoMensajeEmailHtml,
                    attachment = new[] { new { content = pdfBase64, name = nombreArchivoPdf } }
                };

                string jsonString = JsonSerializer.Serialize(payloadCorreo);

                // 7. Enviar correo mediante Brevo

                var apiKey = _configuration["EmailSettings:Password"];

                if (string.IsNullOrWhiteSpace(apiKey))
                {
                    return BadRequest(new
                    {
                        error = "No se encontró la API Key de Brevo."
                    });
                }

                using var requestMessage = new HttpRequestMessage(
                    HttpMethod.Post,
                    "https://api.brevo.com/v3/smtp/email"
                );

                requestMessage.Headers.Accept.Add(
                    new MediaTypeWithQualityHeaderValue("application/json")
                );

                requestMessage.Headers.Add(
                    "api-key",
                    apiKey
                );

                requestMessage.Content = new StringContent(
                    jsonString,
                    Encoding.UTF8,
                    "application/json"
                );

                var apiResponse = await _httpClient.SendAsync(requestMessage);

                string respuestaBrevo =
                    await apiResponse.Content.ReadAsStringAsync();

                Console.WriteLine("===== RESPUESTA BREVO =====");
                Console.WriteLine(respuestaBrevo);

                if (apiResponse.IsSuccessStatusCode)
                {
                    return Ok(new
                    {
                        mensaje = "Reporte enviado exitosamente.",
                        respuestaBrevo
                    });
                }

                return StatusCode(
                    (int)apiResponse.StatusCode,
                    new
                    {
                        error = "Error al enviar correo mediante Brevo",
                        detalle = respuestaBrevo
                    }
                );
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }
        [HttpPost("olvidocontraseña/{correo}")]
        public async Task<IActionResult> Olvidocontraseña(string correo)
        {
            if (string.IsNullOrEmpty(correo))
            {
                return BadRequest(new { mensaje = "El correo electrónico es obligatorio." });
            }

            try
            {
                // 1. Verificar si el correo existe en la base de datos de Aiven
                var correoexistente = await _context.CorreosElectronicos
                    .FirstOrDefaultAsync(e => e.CorreoElectronico == correo);

                if (correoexistente == null)
                {
                    return NotFound(new { mensaje = "El correo electrónico no se encuentra registrado." });
                }

                // 2. Instanciar servicio y aplicar el código cifrado al correo
                var cryptoService = new CryptoService();
                string correoCifrado = cryptoService.Encrypt(correo);

                // 3. Estructurar la URL apuntando a rootpassword.html pasándole el parámetro cifrado
                // Asegúrate de usar 'correo=' para que tu JS de la página pueda extraerlo correctamente
                string urlRestablecer = $"https://sunnyri11.github.io/Sistema-Web-Hemoglobina/rootpassword.html?correo={correoCifrado}";


                // 4. Diseñar la plantilla HTML del correo con el botón de acción
                string cuerpoEmailHtml = $@"
<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);'>
    <div style='background-color: #0f172a; padding: 20px; text-align: center; color: white;'>
        <h2 style='margin: 0; font-size: 22px; letter-spacing: 1px;'>SISTEMA HB</h2>
        <p style='margin: 5px 0 0 0; opacity: 0.8; font-size: 14px;'>Recuperación de Cuenta</p>
    </div>
    <div style='padding: 25px; background-color: #ffffff; color: #334155; line-height: 1.6;'>
        <p style='font-size: 16px; margin-top: 0;'>Hola,</p>
        <p>Hemos recibido una solicitud para restablecer la contraseña asociada a tu cuenta de acceso en el <strong>Sistema HB</strong>.</p>
        <p>Para proceder con el cambio de tu credencial de seguridad, haz clic en el siguiente botón interactivo:</p>
        
        <!-- BOTÓN DE ENLACE DE RESTABLECIMIENTO -->
        <div style='text-align: center; margin: 30px 0;'>
            <a href='{urlRestablecer}' 
               target='_blank' 
               style='background-color: #c0392b; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; font-size: 15px; border-radius: 5px; display: inline-block; box-shadow: 0 2px 4px rgba(192,57,43,0.3);'>
               Restablecer Contraseña
            </a>
        </div>

        <p style='font-size: 13px; color: #64748b;'>Si el botón no funciona, puedes copiar y pegar la siguiente dirección directamente en tu navegador web:</p>
        <p style='font-size: 12px; color: #2980b9; word-break: break-all;'>{urlRestablecer}</p>

        <hr style='border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;' />
        <p style='font-size: 12px; color: #94a3b8; margin-bottom: 0;'>Si tú no solicitaste este cambio, puedes ignorar este message de forma segura.</p>
    </div>
    <div style='background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;'>
        © {DateTime.Now.Year} Sistema HB - Control de Hemoglobina.
    </div>
</div>";

                // 5. Construir el objeto JSON requerido por la API Web de Brevo usando tu configuración
                var payloadCorreo = new
                {
                    sender = new { name = _configuration["EmailSettings:SenderName"] ?? "Sistema Hemoglobina", email = _configuration["EmailSettings:SenderEmail"] ?? "sistemashemoglobina@gmail.com" },
                    to = new[] { new { email = correo, name = "Usuario Sistema HB" } },
                    subject = "🔑 Restablecer Contraseña - Sistema HB",
                    htmlContent = cuerpoEmailHtml
                };

                string jsonString = JsonSerializer.Serialize(payloadCorreo);

                // 6. Enviar la petición Web HTTP POST usando la URL oficial de Brevo
                using var requestMessage = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
                requestMessage.Headers.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));

                // Lee la clave "xkeysib-..." directo de tu archivo de configuración de forma segura
                string apiKey = _configuration["EmailSettings:Password"];
                requestMessage.Headers.TryAddWithoutValidation("api-key", apiKey);

                requestMessage.Content = new StringContent(jsonString, Encoding.UTF8, "application/json");

                var apiResponse = await _httpClient.SendAsync(requestMessage);

                if (apiResponse.IsSuccessStatusCode)
                {
                    return Ok(new
                    {
                        mensaje = "Se ha enviado un enlace de recuperación a tu correo electrónico.",
                    });
                }
                else
                {
                    string errorDetalle = await apiResponse.Content.ReadAsStringAsync();
                    return StatusCode((int)apiResponse.StatusCode, new { error = "Fallo al enviar correo de recuperación web", detalle = errorDetalle });
                }
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }



        [HttpPost("restablecercontraseña/{correo}/{contraseña}")]
        public async Task<IActionResult> restablecercontraseña(string correo, string contraseña)
        {
            try
            {
                // 1. Instanciar el servicio autónomo y descifrar el correo que viene de la URL
                var cryptoService = new CryptoService();
                string correoDescifrado = cryptoService.Decrypt(correo);

                if (string.IsNullOrEmpty(correoDescifrado))
                {
                    return BadRequest(new { mensaje = "El código de recuperación no es válido o ha sido alterado." });
                }

                // 2. Buscar el registro específico usando el correo ya descifrado
                var vefcorreo = await _context.CorreosElectronicos
                    .FirstOrDefaultAsync(e => e.CorreoElectronico == correoDescifrado);

                // 3. Validar si el correo no existe en el sistema
                if (vefcorreo == null)
                {
                    return NotFound(new { mensaje = "El usuario asociado a este enlace no está registrado." });
                }

                // 4. Validar si la nueva contraseña es idéntica a la anterior
                if (vefcorreo.Contraseña == contraseña)
                {
                    return BadRequest(new { mensaje = "La nueva contraseña no puede ser igual a la anterior." });
                }

                // 5. Asignar la nueva credencial de seguridad
                vefcorreo.Contraseña = contraseña;
                _context.Entry(vefcorreo).State = EntityState.Modified;

                // 6. Confirmar y persistir los cambios físicamente en la base de datos de Aiven
                await _context.SaveChangesAsync();

                return Ok(new { mensaje = "Contraseña restablecida correctamente." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

    }
}
