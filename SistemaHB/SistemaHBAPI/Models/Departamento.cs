using System;
using System.Collections.Generic;

namespace SistemaHBAPI.Models;

public partial class Departamento
{
    public int IdDepartamento { get; set; }

    public string? Departamento1 { get; set; }

    public virtual ICollection<Ciudad> Ciudads { get; set; } = new List<Ciudad>();
}
