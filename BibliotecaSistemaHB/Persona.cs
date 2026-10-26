using System;

namespace SistemaHBAPI.Models;

public class PERSONAFORMCLS
{
    public int IdPersona { get; set; }

    public string Nombre { get; set; } = null!;

    public string Apellido { get; set; } = null!;

    public int? IdFechaNacimiento { get; set; }

    public int? IdCorreoElectronico { get; set; }

    public int IdGenero { get; set; }
    public int IdCiudad { get; set; }
}
