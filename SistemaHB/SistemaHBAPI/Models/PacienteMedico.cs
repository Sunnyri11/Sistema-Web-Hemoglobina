using System;
using System.Collections.Generic;

namespace SistemaHBAPI.Models;

public partial class PacienteMedico
{
    public int IdUsuarioMedico { get; set; }

    public int? IdUsuario { get; set; }

    public int? IdMedico { get; set; }

    public virtual Medico? IdMedicoNavigation { get; set; }

    public virtual Usuario? IdUsuarioNavigation { get; set; }
}
