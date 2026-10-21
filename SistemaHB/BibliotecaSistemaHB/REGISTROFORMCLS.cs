using System;
using System.Text.Json.Serialization;
using System.ComponentModel.DataAnnotations;

namespace BibliotecaSistemaHB
{
    public class REGISTROFORMCLS
    {
        [Required(ErrorMessage = "El nombre es obligatorio.")]
        [StringLength(50, MinimumLength = 2, ErrorMessage = "El nombre debe tener entre 2 y 50 caracteres.")]
        [RegularExpression(@"^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$", ErrorMessage = "El nombre solo puede contener letras y espacios.")]
        [JsonPropertyName("nombre")]
        public string? Nombre { get; set; }

        [Required(ErrorMessage = "El apellido paterno es obligatorio.")]
        [StringLength(50, MinimumLength = 2, ErrorMessage = "El apellido paterno debe tener entre 2 y 50 caracteres.")]
        [RegularExpression(@"^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$", ErrorMessage = "El apellido paterno solo puede contener letras y espacios.")]
        [JsonPropertyName("apellidoPaterno")]
        public string? ApellidoPaterno { get; set; }

        [StringLength(50, ErrorMessage = "El apellido materno no puede exceder los 50 caracteres.")]
        [RegularExpression(@"^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]*$", ErrorMessage = "El apellido materno solo puede contener letras y espacios.")]
        [JsonPropertyName("apellidoMaterno")]
        public string? ApellidoMaterno { get; set; }

        [Required(ErrorMessage = "El género es obligatorio.")]
        [RegularExpression(@"^(Masculino|Femenino|m|f|M|F)$", ErrorMessage = "El género proporcionado no es válido.")]
        [JsonPropertyName("genero")]
        public string? Genero { get; set; }

        [Required(ErrorMessage = "La fecha de nacimiento es obligatoria.")]
        [JsonPropertyName("fechaNacimiento")]
        public DateOnly FechaNacimiento { get; set; }

        [Required(ErrorMessage = "El departamento es obligatorio.")]
        [StringLength(100, ErrorMessage = "El nombre del departamento es demasiado largo.")]
        [RegularExpression(@"^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$", ErrorMessage = "El departamento contiene caracteres inválidos.")]
        [JsonPropertyName("departamento")]
        public string? Departamento { get; set; }

        [Required(ErrorMessage = "La provincia es obligatoria.")]
        [StringLength(100, ErrorMessage = "El nombre de la provincia es demasiado largo.")]
        [RegularExpression(@"^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\.\-]+$", ErrorMessage = "La provincia contiene caracteres inválidos.")]
        [JsonPropertyName("provincia")]
        public string? Provincia { get; set; }

        [Required(ErrorMessage = "La altitud es obligatoria.")]
        [Range(-100, 9000, ErrorMessage = "La altitud debe ser un valor geográfico lógico.")]
        [JsonPropertyName("altitud")]
        public decimal Altitud { get; set; }

        [Required(ErrorMessage = "El correo electrónico es obligatorio.")]
        [EmailAddress(ErrorMessage = "El formato del correo electrónico no es válido.")]
        [StringLength(100, ErrorMessage = "El correo electrónico no puede exceder los 100 caracteres.")]
        [JsonPropertyName("correo")]
        public string? Correo { get; set; }

        [Required(ErrorMessage = "La contraseña es obligatoria.")]
        [StringLength(100, MinimumLength = 8, ErrorMessage = "La contraseña debe tener entre 8 y 100 caracteres.")]
        // Bloquea inyecciones básicas impidiendo caracteres como comillas simples o símbolos de ejecución directa
        [RegularExpression(@"^[a-zA-Z0-9ñÑ\s!@#$%^&*()_\-+=\[\]{}|;':"",./<>?]+$", ErrorMessage = "La contraseña contiene caracteres no permitidos.")]
        [JsonPropertyName("password")]
        public string? Password { get; set; }

        [Required(ErrorMessage = "El rol es obligatorio.")]
        [RegularExpression(@"^(Paciente|Medico|Administrador)$", ErrorMessage = "El rol especificado debe ser 'Paciente', 'Medico' o 'Administrador'.")]
        [JsonPropertyName("rol")]
        public string? Rol { get; set; }

        [Range(0, int.MaxValue, ErrorMessage = "El ID de la especialidad debe ser un número entero válido.")]
        [JsonPropertyName("idEspecialidad")]
        public int idEspecialidad { get; set; }

        [Range(0, int.MaxValue, ErrorMessage = "El ID del departamento debe ser un número entero válido.")]
        [JsonPropertyName("idDepartamento")]
        public int idDepartamento { get; set; }

        [JsonPropertyName("tipo_sangre")]
        public string? Tipo_Sangre { get; set; }
    }
}
