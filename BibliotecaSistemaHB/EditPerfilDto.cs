using System;
using System.Collections.Generic;
using System.Text;

namespace BibliotecaSistemaHB
{
    public class EditPerfilDto
    {
        public int IdUsuario { get; set; }
        public string? Nombre { get; set; }
        public string? ApellidoPaterno { get; set; }
        public string? ApellidoMaterno { get; set; }
        public int? Genero { get; set; }
        public DateOnly? FechaNacimiento { get; set; }

        public int? IdCiudad { get; set; }

        public string? Provincia { get; set; }
        public double? Altitud { get; set; }
        public string? Correo { get; set; }
        public string? Password { get; set; }
        public string? Rol { get; set; }
        public string? Tipo_Sangre { get; set; }
        public int? IdEspecialidad { get; set; }

        /// <summary>
        /// Especialidades del médico. Si viene, reemplaza a las actuales (se agregan las nuevas y se
        /// quitan las que ya no están). Si es null, las especialidades no se tocan.
        /// </summary>
        public List<int>? IdEspecialidades { get; set; }
    }
}
