using System;
using System.Collections.Generic;

namespace SistemaHBAPI.Models;

public partial class PacienteAdministrador
{
    public int IdUsuarioAdministrador { get; set; }

    public int? IdUsuario { get; set; }

    public int? IdAdministrador { get; set; }

    public virtual Administrador? IdAdministradorNavigation { get; set; }

    public virtual Usuario? IdUsuarioNavigation { get; set; }
}
