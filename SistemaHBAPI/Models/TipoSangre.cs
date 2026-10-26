using System;
using System.Collections.Generic;

namespace SistemaHBAPI.Models;

public partial class TipoSangre
{
    public int IdTipoSangre { get; set; }

    public string? TipoDeSangre { get; set; }

    public virtual ICollection<Usuario> Usuarios { get; set; } = new List<Usuario>();
}
