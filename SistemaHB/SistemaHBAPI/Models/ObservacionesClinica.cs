namespace SistemaHBAPI.Models
{
    public class ObservacionesClinica
    {

        public int IdObservacion { get; set; }
        public string Observacion { get; set; } = null!;
        public string Descripcion { get; set; } = null!;

        // Propiedad de navegación inversa (Una observación clínica tiene muchos rangos)
        public virtual ICollection<RangoHemoglobina> RangoHemoglobinas { get; set; }
    }
}
