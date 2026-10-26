using System;

namespace BibliotecaSistemaHB.Models;

public class ADMINISTRADORFORMCLS
{
    public int IdAdministrador { get; set; }

    public int? IdPersona { get; set; }
    public string NombrePersona { get; set; } = null!;
    public string DocumentoPersona { get; set; } = null!;
}
