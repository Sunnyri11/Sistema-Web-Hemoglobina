using System;

namespace SistemaHBAPI.Models;

public class CIUDADFORMCLS
{
    public int IdCiudad { get; set; }

    public string Nombre { get; set; } = null!;

    public decimal Altitud { get; set; }

    public int? IdDepartamento { get; set; }
}
