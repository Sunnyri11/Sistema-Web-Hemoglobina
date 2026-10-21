using System;
using System.Collections.Generic;

namespace SistemaHBAPI.Models;

public partial class Usuario
{
    public int IdUsuario { get; set; }

    public int? IdPersona { get; set; }

    public int? IdTipoSangre { get; set; }

    public virtual Persona? IdPersonaNavigation { get; set; }

    public virtual TipoSangre? IdTipoSangreNavigation { get; set; }

    public virtual ICollection<NivelHemoglobina> NivelHemoglobinas { get; set; } = new List<NivelHemoglobina>();

    public virtual ICollection<PacienteAdministrador> PacienteAdministradors { get; set; } = new List<PacienteAdministrador>();

    public virtual ICollection<PacienteMedico> PacienteMedicos { get; set; } = new List<PacienteMedico>();
}
