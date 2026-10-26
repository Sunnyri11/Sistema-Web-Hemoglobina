namespace SistemaHBAPI.Configuracion
{
    /// <summary>Sección "Jwt" de appsettings.json (o variables Jwt__Key, Jwt__Issuer... en Render).</summary>
    public class JwtOptions
    {
        public const string Seccion = "Jwt";
        public string Key { get; set; } = "";
        public string Issuer { get; set; } = "";
        public string Audience { get; set; } = "";
        public int HorasExpiracion { get; set; } = 4;
    }

    /// <summary>Sección "EmailSettings": API de Brevo y remitente.</summary>
    public class EmailOptions
    {
        public const string Seccion = "EmailSettings";
        public string ApiUrl { get; set; } = "https://api.brevo.com/v3/smtp/email";
        public string SenderName { get; set; } = "Sistema Hemoglobina";
        public string SenderEmail { get; set; } = "sistemashemoglobina@gmail.com";
        /// <summary>API key de Brevo (xkeysib-...). Se mantiene el nombre "Password" por compatibilidad.</summary>
        public string? Password { get; set; }
    }

    /// <summary>Sección "Walle": microservicio de IA en Render.</summary>
    public class WalleOptions
    {
        public const string Seccion = "Walle";
        public string Url { get; set; } = "https://walle-hb.onrender.com";
        /// <summary>Render gratis tarda ~50 s en despertar.</summary>
        public int TimeoutSegundos { get; set; } = 90;
    }

    /// <summary>Sección "Frontend": páginas a las que apuntan los correos.</summary>
    public class FrontendOptions
    {
        public const string Seccion = "Frontend";
        public string UrlRestablecer { get; set; } = "https://sunnyri11.github.io/Sistema-Web-Hemoglobina/rootpassword.html";
    }

    /// <summary>Sección "Seguridad".</summary>
    public class SeguridadOptions
    {
        public const string Seccion = "Seguridad";
        /// <summary>Al iniciar, convierte a hash las contraseñas que aún estén en texto plano.</summary>
        public bool MigrarPasswordsAlIniciar { get; set; } = true;
    }
}
