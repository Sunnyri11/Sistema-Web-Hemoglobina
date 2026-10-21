using System.Text.Json.Serialization;
using System.ComponentModel.DataAnnotations;

namespace BibliotecaSistemaHB
{
    public class LOGINFORMCLS
    {
        [Required(ErrorMessage = "El correo electrónico es obligatorio.")]
        [EmailAddress(ErrorMessage = "El formato del correo electrónico no es válido.")]
        [StringLength(100, ErrorMessage = "El correo electrónico excede el límite permitido.")]
        [JsonPropertyName("email")]
        public string? Email { get; set; }

        [Required(ErrorMessage = "La contraseña es obligatoria.")]
        [StringLength(100, ErrorMessage = "La contraseña excede el límite permitido.")]
        [JsonPropertyName("password")]
        public string? Password { get; set; }

        [Required(ErrorMessage = "El rol es obligatorio.")]
        [RegularExpression(@"^(Paciente|Medico|Administrador)$", ErrorMessage = "El rol especificado no es válido.")]
        [JsonPropertyName("rol")]
        public string? Rol { get; set; }
    }
}
