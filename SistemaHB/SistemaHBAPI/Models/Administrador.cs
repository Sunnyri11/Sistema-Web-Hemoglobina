using System;
using System.Collections.Generic;

namespace SistemaHBAPI.Models;

public partial class Administrador
{
    public int IdAdministrador { get; set; }

    public int? IdPersona { get; set; }

    public virtual Persona? IdPersonaNavigation { get; set; }

    public virtual ICollection<PacienteAdministrador> PacienteAdministradors { get; set; } = new List<PacienteAdministrador>();
}
