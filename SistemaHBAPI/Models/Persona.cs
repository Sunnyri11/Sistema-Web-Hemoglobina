using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;

namespace SistemaHBAPI.Models;

public partial class Persona
{
    public int IdPersona { get; set; }

    public string Nombre { get; set; } = null!;

    public string Paterno { get; set; } = null!;
    public string Materno { get; set; } = null!;

    public int? IdFechaNacimiento { get; set; }

    public int? IdCorreoElectronico { get; set; }

    public int IdGenero { get; set; }
    public int IdCiudad { get; set; }

    public virtual ICollection<Administrador> Administradors { get; set; } = new List<Administrador>();

    public virtual CorreosElectronico? IdCorreoElectronicoNavigation { get; set; }

    public virtual FechaNacimiento? IdFechaNacimientoNavigation { get; set; }

    public virtual Genero IdGeneroNavigation { get; set; } = null!;

    public virtual Ciudad IdCiudadNavigation { get; set; } = null!;

    public virtual ICollection<Medico> Medicos { get; set; } = new List<Medico>();

    public virtual ICollection<Usuario> Usuarios { get; set; } = new List<Usuario>();

}
