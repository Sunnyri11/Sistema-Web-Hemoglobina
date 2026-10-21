using System;
using System.Collections.Generic;


namespace SistemaHBAPI.Models
{
    public class EdadPredeterminada
    {
        public int IdEdad { get; set; }

        public int Edad { get; set; }

        public virtual ICollection<RangoHemoglobina> RangoHemoglobinas { get; set; } = new List<RangoHemoglobina>();
    }
}

