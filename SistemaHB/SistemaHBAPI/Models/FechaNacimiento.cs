using System;
using System.Collections.Generic;

namespace SistemaHBAPI.Models;

public partial class FechaNacimiento
{
    public int IdFechaNacimiento { get; set; }

    public DateOnly? FechaDeNacimiento { get; set; }

    public virtual ICollection<Persona> Personas { get; set; } = new List<Persona>();
}
