using System.Text.Json.Serialization;

namespace BibliotecaSistemaHB.Walle
{
    /// <summary>Respuesta de Walle-HB (FastAPI en Render). Se lee en snake_case.</summary>
    public class RespuestaIaModel
    {
        [JsonPropertyName("estado")]
        public string[]? Estado { get; set; }

        [JsonPropertyName("prediccion_ia")]
        public string? PrediccionIa { get; set; }

        [JsonPropertyName("alertas")]
        public string[]? Alertas { get; set; }

        [JsonPropertyName("recomendaciones")]
        public string[]? Recomendaciones { get; set; }

        [JsonPropertyName("prediccion")]
        public PrediccionIaModel? Prediccion { get; set; }
    }

    /// <summary>
    /// Proyección y análisis de riesgo. Se lee en snake_case desde Walle-HB y se envía al frontend
    /// en camelCase (valorActual, valorProyectado, ...), que es lo que espera paciente.js.
    /// </summary>
    public class PrediccionIaModel
    {
        [JsonPropertyName("valor_actual")]            public double ValorActual { get; set; }
        [JsonPropertyName("valor_proyectado")]        public double ValorProyectado { get; set; }
        [JsonPropertyName("horizonte_dias")]          public int HorizonteDias { get; set; }
        [JsonPropertyName("estado_proyectado")]       public string? EstadoProyectado { get; set; }
        [JsonPropertyName("tendencia")]               public string? Tendencia { get; set; }
        [JsonPropertyName("cambio_esperado")]         public double CambioEsperado { get; set; }
        [JsonPropertyName("riesgo")]                  public string? Riesgo { get; set; }
        [JsonPropertyName("gravedad")]                public string? Gravedad { get; set; }
        [JsonPropertyName("margen_al_limite")]        public double? MargenAlLimite { get; set; }
        [JsonPropertyName("dias_hasta_salir_rango")]  public int? DiasHastaSalirRango { get; set; }
        [JsonPropertyName("dias_hasta_normalizar")]   public int? DiasHastaNormalizar { get; set; }
        [JsonPropertyName("proximo_control_dias")]    public int ProximoControlDias { get; set; }
        [JsonPropertyName("confianza")]               public string? Confianza { get; set; }
        [JsonPropertyName("puntos_usados")]           public int PuntosUsados { get; set; }
        [JsonPropertyName("fechas_reales")]           public bool FechasReales { get; set; }
        [JsonPropertyName("rango_referencia")]        public double[]? RangoReferencia { get; set; }
    }

    /// <summary>Lo que Walle-HB le entrega a la pantalla del paciente (analisisIA).</summary>
    public class AnalisisIaDto
    {
        public string Estado { get; set; } = "Sin datos";
        public string Alertas { get; set; } = "";
        public string[] Recomendaciones { get; set; } = Array.Empty<string>();
        public PrediccionIaModel? Prediccion { get; set; }
    }
}
