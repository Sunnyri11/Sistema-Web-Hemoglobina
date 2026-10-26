using System;
using System.Collections.Generic;

namespace SistemaHBAPI.Models;

public partial class Medico
{
    public int IdMedico { get; set; }

    public int? IdPersona { get; set; }

    public virtual Persona? IdPersonaNavigation { get; set; }

    public virtual ICollection<MedicoEspecialidad> MedicoEspecialidads { get; set; } = new List<MedicoEspecialidad>();

    public virtual ICollection<PacienteMedico> PacienteMedicos { get; set; } = new List<PacienteMedico>();
}
