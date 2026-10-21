using System;
using System.Collections.Generic;

namespace SistemaHBAPI.Models;

public partial class Especialidade
{
    public int IdEspecialidad { get; set; }

    public string? Nombre { get; set; }

    public virtual ICollection<MedicoEspecialidad> MedicoEspecialidads { get; set; } = new List<MedicoEspecialidad>();
}
