using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using SistemaHBAPI.Models;

namespace SistemaHBAPI.Services.Correo
{
    public interface IReporteService
    {
        /// <summary>Genera el PDF clínico del paciente y lo envía por Brevo.</summary>
        Task<Resultado> EnviarReporteAsync(int idUsuario, string correoDestino);
    }

    public sealed class ReporteService : IReporteService
    {
        private const string Normal = "Normal (Estable)";
        private const string Anemia = "Alerta de Anemia";
        private const string Poliglobulia = "Alerta de Poliglobulia";

        private readonly SistemaHBContext _context;
        private readonly IEmailService _email;

        public ReporteService(SistemaHBContext context, IEmailService email)
        {
            _context = context;
            _email = email;
        }

        public async Task<Resultado> EnviarReporteAsync(int idUsuario, string correoDestino)
        {
            if (string.IsNullOrEmpty(correoDestino))
                return Resultado.BadRequest(new { mensaje = "El correo electrónico es obligatorio." });

            try
            {
                var nombre = await ObtenerNombrePacienteAsync(idUsuario);

                // Cada análisis se evalúa con el rango con el que fue registrado (ciudad, género, edad y observación).
                var historial = await _context.NivelHemoglobinas
                    .Include(n => n.IdRangoHemoglobinaNavigation)
                    .Where(e => e.IdUsuario == idUsuario)
                    .OrderByDescending(e => e.IdNivel)
                    .ToListAsync();

                if (!historial.Any())
                    return Resultado.Ok(new { mensaje = "Sin historial para generar el reporte." });

                var (ultimoEstado, colorEstado) = Evaluar(historial[0]);
                var html = PlantillasCorreo.Reporte(nombre, historial.Count, ultimoEstado, colorEstado);
                var pdf = GenerarPdf(nombre, correoDestino, historial);

                var envio = await _email.EnviarAsync(
                    correoDestino, nombre,
                    $"📋 Reporte de Control de Hemoglobina - {nombre}",
                    html, pdf, $"Reporte_Hemoglobina_Usuario_{idUsuario}.pdf");

                if (envio.FaltaApiKey)
                    return Resultado.BadRequest(new { error = envio.Detalle });

                if (envio.Exitoso)
                    return Resultado.Ok(new { mensaje = "Reporte enviado exitosamente.", respuestaBrevo = envio.Detalle });

                return Resultado.ConCodigo(envio.Codigo, new { error = "Error al enviar correo mediante Brevo", detalle = envio.Detalle });
            }
            catch (Exception ex)
            {
                return Resultado.BadRequest(new { error = ex.Message });
            }
        }

        private async Task<string> ObtenerNombrePacienteAsync(int idUsuario)
        {
            var persona = (await _context.Usuarios
                .Include(u => u.IdPersonaNavigation)
                .FirstOrDefaultAsync(u => u.IdUsuario == idUsuario))?.IdPersonaNavigation;

            return persona == null ? "Paciente" : $"{persona.Nombre} {persona.Paterno} {persona.Materno}".Trim();
        }

        private static (string Estado, string Color) Evaluar(NivelHemoglobina n)
        {
            var rango = n.IdRangoHemoglobinaNavigation;
            if (n.ValorHemoglobina < rango.ValorMin) return (Anemia, "#c0392b");
            if (n.ValorHemoglobina > rango.ValorMax) return (Poliglobulia, "#d35400");
            return (Normal, "#27ae60");
        }

        private static byte[] GenerarPdf(string nombre, string correo, List<NivelHemoglobina> historial)
        {
            int total = historial.Count;

            using var stream = new MemoryStream();
            Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(1, Unit.Inch);
                    page.DefaultTextStyle(x => x.FontFamily(Fonts.Lato));

                    page.Header().Background("#0f172a").Padding(15).Text("SISTEMA HB - REPORTE CLÍNICO")
                        .FontColor("#ffffff").FontSize(20).Bold();

                    page.Content().PaddingVertical(20).Column(columna =>
                    {
                        columna.Item().Text($"Paciente: {nombre}").FontSize(12).Bold();
                        columna.Item().Text($"Correo Electrónico: {correo}").FontSize(11);
                        columna.Item().Text($"Total de Análisis: {total}").FontSize(11);

                        columna.Item().PaddingTop(20).Table(tabla =>
                        {
                            tabla.ColumnsDefinition(cols =>
                            {
                                cols.RelativeColumn(1.5f);
                                cols.RelativeColumn(2f);
                                cols.RelativeColumn(2f);
                                cols.RelativeColumn(2.5f);
                            });

                            foreach (var titulo in new[] { "Secuencia", "Fecha", "Hemoglobina", "Evaluación" })
                                tabla.Cell().Background("#2980b9").Padding(8).Text(titulo).FontColor("#ffffff").Bold();

                            for (int i = 0; i < total; i++)
                            {
                                var registro = historial[i];
                                var (evaluacion, color) = Evaluar(registro);

                                Celda(tabla, $"Medición {total - i}");
                                Celda(tabla, registro.FechaAnalisis.ToShortDateString());
                                Celda(tabla, $"{registro.ValorHemoglobina:F2} g/dL");
                                Celda(tabla, evaluacion, color, negrita: true);
                            }
                        });
                    });
                });
            }).GeneratePdf(stream);

            return stream.ToArray();
        }

        private static void Celda(TableDescriptor tabla, string texto, string? color = null, bool negrita = false)
        {
            var t = tabla.Cell()
                .BorderBottom(1, Unit.Point).BorderColor("#e2e8f0").Padding(8)
                .Text(texto);
            if (color != null) t.FontColor(color);
            if (negrita) t.Bold();
        }
    }
}
