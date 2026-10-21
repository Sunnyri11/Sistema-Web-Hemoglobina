using System;

namespace SistemaHBAPI.Models;

public class NIVELHEMOGLOBINAFORMCLS
{
    public int IdNivel { get; set; }

    public int IdUsuario { get; set; }

    public int IdRangoHemoglobina { get; set; }

    public decimal ValorHemoglobina { get; set; }

    public decimal Temperatura { get; set; }

    public DateOnly FechaAnalisis { get; set; }
}
