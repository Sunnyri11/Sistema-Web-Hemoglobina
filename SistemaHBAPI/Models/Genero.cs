using System;
using System.Collections.Generic;

namespace SistemaHBAPI.Models;

public partial class Genero
{
    public int IdGenero { get; set; }

    public string Nombre { get; set; } = null!;

    public virtual ICollection<Persona> Personas { get; set; } = new List<Persona>();

    public virtual ICollection<RangoHemoglobina> RangoHemoglobinas { get; set; } = new List<RangoHemoglobina>();
}
