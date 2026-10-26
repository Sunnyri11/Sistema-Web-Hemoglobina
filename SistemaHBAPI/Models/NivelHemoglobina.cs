using System;
using System.Collections.Generic;

namespace SistemaHBAPI.Models;

public partial class NivelHemoglobina
{
    public int IdNivel { get; set; }

    public int IdUsuario { get; set; }

    public int IdRangoHemoglobina { get; set; }

    public decimal ValorHemoglobina { get; set; }
    public decimal Temperatura {  get; set; }

    public DateOnly FechaAnalisis { get; set; }

    public virtual RangoHemoglobina IdRangoHemoglobinaNavigation { get; set; } = null!;

    public virtual Usuario IdUsuarioNavigation { get; set; } = null!;
}
