using System;
using System.Collections.Generic;

namespace SistemaHBAPI.Models;

public partial class CorreosElectronico
{
    public int IdCorreoElectronico { get; set; }

    public string? CorreoElectronico { get; set; }

    public string? Contraseña { get; set; }

    public virtual ICollection<Persona> Personas { get; set; } = new List<Persona>();
}
