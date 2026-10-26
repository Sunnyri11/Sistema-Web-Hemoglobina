using System;

namespace SistemaHBAPI.Models;

public class RANGOHEMOGLOBINAFORMCLS
{
    public int IdRango { get; set; }

    public int IdCiudad { get; set; }

    public int IdGenero { get; set; }
    public int? IdEdad { get; set; }

    public decimal ValorMin { get; set; }

    public decimal ValorMax { get; set; }
}
