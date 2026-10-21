using System;
using System.Collections.Generic;

namespace SistemaHBAPI.Models;

public partial class Ciudad
{
    public int IdCiudad { get; set; }

    public string Nombre { get; set; } = null!;

    public decimal Altitud { get; set; }

    public int? IdDepartamento { get; set; }

    public virtual Departamento? IdDepartamentoNavigation { get; set; }
    public virtual ICollection<Persona> Personas { get; set; } = new List<Persona>();


    public virtual ICollection<RangoHemoglobina> RangoHemoglobinas { get; set; } = new List<RangoHemoglobina>();
}
