using System;
using System.Collections.Generic;

namespace SistemaHBAPI.Models;

public partial class RangoHemoglobina
{
    public int IdRango { get; set; }

    public int IdCiudad { get; set; }

    public int IdGenero { get; set; }

    public decimal ValorMin { get; set; }

    public decimal ValorMax { get; set; }
    public int IdEdad { get; set; }
    public virtual EdadPredeterminada IdEdadNavigation { get; set; } = null!;
    public virtual Ciudad IdCiudadNavigation { get; set; } = null!;

    public virtual Genero IdGeneroNavigation { get; set; } = null!;
    public int? IdObservacion { get; set; }
    public virtual ObservacionesClinica IdObservacionNavigation { get; set; }


    public virtual ICollection<NivelHemoglobina> NivelHemoglobinas { get; set; } = new List<NivelHemoglobina>();
}
