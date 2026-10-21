using System;
using System.Collections.Generic;

namespace SistemaHBAPI.Models;

public partial class MedicoEspecialidad
{
    public int IdMedicoEspecialidad { get; set; }

    public int? IdMedico { get; set; }

    public int? IdEspecialidad { get; set; }

    public virtual Especialidade? IdEspecialidadNavigation { get; set; }

    public virtual Medico? IdMedicoNavigation { get; set; }
}
