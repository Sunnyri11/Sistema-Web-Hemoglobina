namespace BibliotecaSistemaHB
{
    /// <summary>Un análisis del historial del paciente, con el rango con el que se evaluó.</summary>
    public class RegistroHemoglobinaDto
    {
        public int IdNivel { get; set; }
        public decimal ValorHemoglobina { get; set; }
        public string Fecha { get; set; } = "";
        public decimal Temperatura { get; set; }
        public decimal ValorMin { get; set; }
        public decimal ValorMax { get; set; }
    }

    /// <summary>Cuerpo de POST api/Dashboard/guardarAnalisis/{idObservacion}.</summary>
    public class RequestAnalisis
    {
        public decimal ValorHemoglobina { get; set; }
        public decimal Temperatura { get; set; }
        public DateTime FechaAnalisis { get; set; }
    }
}
