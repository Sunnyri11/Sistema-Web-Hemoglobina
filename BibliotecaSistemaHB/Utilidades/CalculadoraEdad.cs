namespace BibliotecaSistemaHB.Utilidades
{
    public static class CalculadoraEdad
    {
        /// <summary>Edad en años cumplidos a la fecha indicada.</summary>
        public static int Calcular(DateOnly nacimiento, DateOnly hoy)
        {
            int edad = hoy.Year - nacimiento.Year;
            if (nacimiento > hoy.AddYears(-edad)) edad--;
            return edad;
        }

        public static int Calcular(DateOnly nacimiento) =>
            Calcular(nacimiento, DateOnly.FromDateTime(DateTime.Today));
    }
}
