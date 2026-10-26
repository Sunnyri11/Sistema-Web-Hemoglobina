using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace SistemaHBAPI.Models;

public partial class SistemaHBContext : DbContext
{
    public SistemaHBContext()
    {
    }

    public SistemaHBContext(DbContextOptions<SistemaHBContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Administrador> Administradors { get; set; }
    public virtual DbSet<Ciudad> Ciudads { get; set; }
    public virtual DbSet<CorreosElectronico> CorreosElectronicos { get; set; }
    public virtual DbSet<Departamento> Departamentos { get; set; }
    public virtual DbSet<Especialidade> Especialidades { get; set; }
    public virtual DbSet<FechaNacimiento> FechaNacimientos { get; set; }
    public virtual DbSet<Genero> Generos { get; set; }
    public virtual DbSet<Medico> Medicos { get; set; }
    public virtual DbSet<MedicoEspecialidad> MedicoEspecialidads { get; set; }
    public virtual DbSet<NivelHemoglobina> NivelHemoglobinas { get; set; }
    public virtual DbSet<PacienteAdministrador> PacienteAdministradors { get; set; }
    public virtual DbSet<PacienteMedico> PacienteMedicos { get; set; }
    public virtual DbSet<Persona> Personas { get; set; }
    public virtual DbSet<RangoHemoglobina> RangoHemoglobinas { get; set; }
    public virtual DbSet<TipoSangre> TipoSangres { get; set; }
    public virtual DbSet<Usuario> Usuarios { get; set; }
    public virtual DbSet<EdadPredeterminada>Edades { get; set; }
    public virtual DbSet<ObservacionesClinica> ObservacionesClinicas { get; set; }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder
            .UseCollation("utf8mb4_0900_ai_ci")
            .HasCharSet("utf8mb4");

        modelBuilder.Entity<Administrador>(entity =>
        {
            entity.HasKey(e => e.IdAdministrador).HasName("PRIMARY");
            entity.ToTable("administrador");

            entity.HasIndex(e => e.IdPersona, "id_persona");

            entity.Property(e => e.IdAdministrador).HasColumnName("id_administrador");
            entity.Property(e => e.IdPersona).HasColumnName("id_persona");

            entity.HasOne(d => d.IdPersonaNavigation).WithMany(p => p.Administradors)
                .HasForeignKey(d => d.IdPersona)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("administrador_ibfk_1");
        });

        modelBuilder.Entity<Ciudad>(entity =>
        {
            entity.HasKey(e => e.IdCiudad).HasName("PRIMARY");
            entity.ToTable("ciudad");

            entity.HasIndex(e => e.IdDepartamento, "id_departamento");

            entity.Property(e => e.IdCiudad).HasColumnName("id_ciudad");
            entity.Property(e => e.Altitud)
                .HasPrecision(10, 2)
                .HasColumnName("altitud");
            entity.Property(e => e.IdDepartamento).HasColumnName("id_departamento");
            entity.Property(e => e.Nombre)
                .HasMaxLength(100)
                .HasColumnName("nombre");

            entity.HasOne(d => d.IdDepartamentoNavigation).WithMany(p => p.Ciudads)
                .HasForeignKey(d => d.IdDepartamento)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("ciudad_ibfk_1");
        });

        modelBuilder.Entity<CorreosElectronico>(entity =>
        {
            entity.HasKey(e => e.IdCorreoElectronico).HasName("PRIMARY");
            entity.ToTable("correos_electronicos");

            entity.HasIndex(e => e.CorreoElectronico, "correo_electronico").IsUnique();

            entity.Property(e => e.IdCorreoElectronico).HasColumnName("id_correo_electronico");
            entity.Property(e => e.Contraseña)
                .HasColumnType("text")
                .HasColumnName("contraseña");
            entity.Property(e => e.CorreoElectronico)
                .HasMaxLength(250)
                .HasColumnName("correo_electronico");
        });

        modelBuilder.Entity<Departamento>(entity =>
        {
            entity.HasKey(e => e.IdDepartamento).HasName("PRIMARY");
            entity.ToTable("departamentos");

            entity.Property(e => e.IdDepartamento).HasColumnName("id_departamento");
            entity.Property(e => e.Departamento1)
                .HasMaxLength(200)
                .HasColumnName("departamento");
        });

        modelBuilder.Entity<Especialidade>(entity =>
        {
            entity.HasKey(e => e.IdEspecialidad).HasName("PRIMARY");
            entity.ToTable("especialidades");

            entity.Property(e => e.IdEspecialidad)
                .ValueGeneratedNever()
                .HasColumnName("id_especialidad");
            entity.Property(e => e.Nombre)
                .HasMaxLength(200)
                .HasColumnName("nombre");
        });

        modelBuilder.Entity<FechaNacimiento>(entity =>
        {
            entity.HasKey(e => e.IdFechaNacimiento).HasName("PRIMARY");
            entity.ToTable("fecha_nacimiento");

            entity.Property(e => e.IdFechaNacimiento).HasColumnName("id_fecha_nacimiento");
            entity.Property(e => e.FechaDeNacimiento).HasColumnName("fecha_de_nacimiento");
        });

        modelBuilder.Entity<Genero>(entity =>
        {
            entity.HasKey(e => e.IdGenero).HasName("PRIMARY");
            entity.ToTable("genero");

            entity.HasIndex(e => e.Nombre, "nombre").IsUnique();

            entity.Property(e => e.IdGenero).HasColumnName("id_genero");
            entity.Property(e => e.Nombre)
                .HasColumnType("enum('Masculino','Femenino')")
                .HasColumnName("nombre");
        });

        modelBuilder.Entity<Medico>(entity =>
        {
            entity.HasKey(e => e.IdMedico).HasName("PRIMARY");
            entity.ToTable("medico");

            entity.HasIndex(e => e.IdPersona, "id_persona");

            entity.Property(e => e.IdMedico).HasColumnName("id_medico");
            entity.Property(e => e.IdPersona).HasColumnName("id_persona");

            entity.HasOne(d => d.IdPersonaNavigation).WithMany(p => p.Medicos)
                .HasForeignKey(d => d.IdPersona)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("medico_ibfk_1");
        });

        modelBuilder.Entity<MedicoEspecialidad>(entity =>
        {
            entity.HasKey(e => e.IdMedicoEspecialidad).HasName("PRIMARY");
            entity.ToTable("medico_especialidad");

            entity.HasIndex(e => e.IdEspecialidad, "id_especialidad");
            entity.HasIndex(e => e.IdMedico, "id_medico");

            entity.Property(e => e.IdMedicoEspecialidad).HasColumnName("id_medico_especialidad");
            entity.Property(e => e.IdEspecialidad).HasColumnName("id_especialidad");
            entity.Property(e => e.IdMedico).HasColumnName("id_medico");

            entity.HasOne(d => d.IdEspecialidadNavigation).WithMany(p => p.MedicoEspecialidads)
                .HasForeignKey(d => d.IdEspecialidad)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("medico_especialidad_ibfk_2");

            entity.HasOne(d => d.IdMedicoNavigation).WithMany(p => p.MedicoEspecialidads)
                .HasForeignKey(d => d.IdMedico)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("medico_especialidad_ibfk_1");
        });
        modelBuilder.Entity<NivelHemoglobina>(entity =>
        {
            entity.HasKey(e => e.IdNivel).HasName("PRIMARY");
            entity.ToTable("nivel_hemoglobina");

            entity.HasIndex(e => e.IdRangoHemoglobina, "id_rango_hemoglobina");
            entity.HasIndex(e => e.IdUsuario, "id_usuario");

            entity.Property(e => e.IdNivel).HasColumnName("id_nivel");
            entity.Property(e => e.FechaAnalisis).HasColumnName("fecha_analisis");
            entity.Property(e => e.IdRangoHemoglobina).HasColumnName("id_rango_hemoglobina");
            entity.Property(e => e.IdUsuario).HasColumnName("id_usuario");
            entity.Property(e => e.ValorHemoglobina)
                .HasPrecision(4, 2)
                .HasColumnName("valor_hemoglobina");
            entity.Property(e => e.Temperatura).HasPrecision(5,2).HasColumnName("temperatura");

            entity.HasOne(d => d.IdRangoHemoglobinaNavigation).WithMany(p => p.NivelHemoglobinas)
                .HasForeignKey(d => d.IdRangoHemoglobina)
                .HasConstraintName("nivel_hemoglobina_ibfk_2");

            entity.HasOne(d => d.IdUsuarioNavigation).WithMany(p => p.NivelHemoglobinas)
                .HasForeignKey(d => d.IdUsuario)
                .HasConstraintName("nivel_hemoglobina_ibfk_1");
        });

        modelBuilder.Entity<PacienteAdministrador>(entity =>
        {
            entity.HasKey(e => e.IdUsuarioAdministrador).HasName("PRIMARY");
            entity.ToTable("paciente_administrador");

            entity.HasIndex(e => e.IdAdministrador, "id_administrador");
            entity.HasIndex(e => e.IdUsuario, "id_usuario");

            entity.Property(e => e.IdUsuarioAdministrador).HasColumnName("id_usuario_administrador");
            entity.Property(e => e.IdAdministrador).HasColumnName("id_administrador");
            entity.Property(e => e.IdUsuario).HasColumnName("id_usuario");

            entity.HasOne(d => d.IdAdministradorNavigation).WithMany(p => p.PacienteAdministradors)
                .HasForeignKey(d => d.IdAdministrador)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("paciente_administrador_ibfk_2");

            entity.HasOne(d => d.IdUsuarioNavigation).WithMany(p => p.PacienteAdministradors)
                .HasForeignKey(d => d.IdUsuario)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("paciente_administrador_ibfk_1");
        });

        modelBuilder.Entity<PacienteMedico>(entity =>
        {
            entity.HasKey(e => e.IdUsuarioMedico).HasName("PRIMARY");
            entity.ToTable("paciente_medico");

            entity.HasIndex(e => e.IdMedico, "id_medico");
            entity.HasIndex(e => e.IdUsuario, "id_usuario");

            entity.Property(e => e.IdUsuarioMedico).HasColumnName("id_usuario_medico");
            entity.Property(e => e.IdMedico).HasColumnName("id_medico");
            entity.Property(e => e.IdUsuario).HasColumnName("id_usuario");

            entity.HasOne(d => d.IdMedicoNavigation).WithMany(p => p.PacienteMedicos)
                .HasForeignKey(d => d.IdMedico)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("paciente_medico_ibfk_2");

            entity.HasOne(d => d.IdUsuarioNavigation).WithMany(p => p.PacienteMedicos)
                .HasForeignKey(d => d.IdUsuario)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("paciente_medico_ibfk_1");
        });

        modelBuilder.Entity<Persona>(entity =>
        {
            entity.HasKey(e => e.IdPersona).HasName("PRIMARY");
            entity.ToTable("persona");

            entity.HasIndex(e => e.IdCorreoElectronico, "id_correo_electronico");
            entity.HasIndex(e => e.IdFechaNacimiento, "id_fecha_nacimiento");
            entity.HasIndex(e => e.IdGenero, "id_genero");

            entity.Property(e => e.IdPersona).HasColumnName("id_persona");
            entity.Property(e => e.Paterno)
                .HasMaxLength(100)
                .HasColumnName("paterno");
            entity.Property(e => e.Materno)
                .HasMaxLength(100)
                .HasColumnName("materno");
            entity.Property(e => e.IdCorreoElectronico).HasColumnName("id_correo_electronico");
            entity.Property(e => e.IdFechaNacimiento).HasColumnName("id_fecha_nacimiento");
            entity.Property(e => e.IdGenero).HasColumnName("id_genero");
            entity.Property(e => e.IdCiudad).HasColumnName("id_ciudad");
            entity.Property(e => e.Nombre)
                .HasMaxLength(100)
                .HasColumnName("nombre");

            entity.HasOne(d => d.IdCiudadNavigation)
                .WithMany(p => p.Personas)
                .HasForeignKey(d => d.IdCiudad)
                .HasConstraintName("persona_ibfk_4");

            entity.HasOne(d => d.IdCorreoElectronicoNavigation).WithMany(p => p.Personas)
                .HasForeignKey(d => d.IdCorreoElectronico)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("persona_ibfk_2");

            entity.HasOne(d => d.IdFechaNacimientoNavigation).WithMany(p => p.Personas)
                .HasForeignKey(d => d.IdFechaNacimiento)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("persona_ibfk_1");

            entity.HasOne(d => d.IdGeneroNavigation).WithMany(p => p.Personas)
                .HasForeignKey(d => d.IdGenero)
                .HasConstraintName("persona_ibfk_3");
        });

        modelBuilder.Entity<RangoHemoglobina>(entity =>
        {
            entity.HasKey(e => e.IdRango).HasName("PRIMARY");
            entity.ToTable("rango_hemoglobina");

            entity.HasIndex(e => e.IdCiudad, "id_ciudad");
            entity.HasIndex(e => e.IdGenero, "id_genero");
            entity.HasIndex(e => e.IdEdad, "id_edad");
            // Se agrega el índice para la llave foránea de la observación clínica
            entity.HasIndex(e => e.IdObservacion, "fk_observacio_rango");

            entity.Property(e => e.IdRango).HasColumnName("id_rango");
            entity.Property(e => e.IdCiudad).HasColumnName("id_ciudad");
            entity.Property(e => e.IdGenero).HasColumnName("id_genero");
            entity.Property(e => e.IdEdad).HasColumnName("id_edad");
            // Mapeo del nuevo campo en la entidad
            entity.Property(e => e.IdObservacion).HasColumnName("id_observacion");

            entity.Property(e => e.ValorMax)
                .HasPrecision(4, 2)
                .HasColumnName("valor_max");
            entity.Property(e => e.ValorMin)
                .HasPrecision(4, 2)
                .HasColumnName("valor_min");

            entity.HasOne(d => d.IdCiudadNavigation).WithMany(p => p.RangoHemoglobinas)
                .HasForeignKey(d => d.IdCiudad)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("rango_hemoglobina_ibfk_1");

            entity.HasOne(d => d.IdGeneroNavigation).WithMany(p => p.RangoHemoglobinas)
                .HasForeignKey(d => d.IdGenero)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("rango_hemoglobina_ibfk_2");

            entity.HasOne(d => d.IdEdadNavigation).WithMany(p => p.RangoHemoglobinas)
                .HasForeignKey(d => d.IdEdad)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("rango_hemoglobina_ibfk_3");

            // Nueva relación con la tabla observaciones_clinica (permite valores NULL)
            entity.HasOne(d => d.IdObservacionNavigation).WithMany(p => p.RangoHemoglobinas)
                .HasForeignKey(d => d.IdObservacion)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_observacio_rango");
        });

        modelBuilder.Entity<ObservacionesClinica>(entity =>
        {
            // Define la llave primaria de la tabla
            entity.HasKey(e => e.IdObservacion).HasName("PRIMARY");

            // Nombre exacto de la tabla en MySQL
            entity.ToTable("observaciones_clinica");

            // Configuración de las propiedades y nombres de columnas
            entity.Property(e => e.IdObservacion)
                .HasColumnName("id_observacion");

            entity.Property(e => e.Observacion)
                .HasMaxLength(150)
                .HasColumnName("observacion");

            entity.Property(e => e.Descripcion)
                .HasColumnType("text")
                .HasColumnName("descripcion");
        });


        modelBuilder.Entity<EdadPredeterminada>(entity =>
        {
            entity.HasKey(e => e.IdEdad).HasName("PRIMARY");
            entity.ToTable("edad_predeterminada");

            entity.Property(e => e.IdEdad).HasColumnName("id_edad");

            entity.Property(e => e.Edad)
                .IsRequired()
                .HasColumnName("edad");
        });


        modelBuilder.Entity<TipoSangre>(entity =>
        {
            entity.HasKey(e => e.IdTipoSangre).HasName("PRIMARY");
            entity.ToTable("tipo_sangre");

            entity.Property(e => e.IdTipoSangre).HasColumnName("id_tipo_sangre");
            entity.Property(e => e.TipoDeSangre)
                .HasMaxLength(100)
                .HasColumnName("tipo_de_sangre");
        });

        modelBuilder.Entity<Usuario>(entity =>
        {
            entity.HasKey(e => e.IdUsuario).HasName("PRIMARY");
            entity.ToTable("usuario");

            entity.HasIndex(e => e.IdPersona, "id_persona");
            entity.HasIndex(e => e.IdTipoSangre, "id_tipo_sangre");

            entity.Property(e => e.IdUsuario).HasColumnName("id_usuario");
            entity.Property(e => e.IdPersona).HasColumnName("id_persona");
            entity.Property(e => e.IdTipoSangre).HasColumnName("id_tipo_sangre");

            entity.HasOne(d => d.IdPersonaNavigation).WithMany(p => p.Usuarios)
                .HasForeignKey(d => d.IdPersona)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("usuario_ibfk_1");

            entity.HasOne(d => d.IdTipoSangreNavigation).WithMany(p => p.Usuarios)
                .HasForeignKey(d => d.IdTipoSangre)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("usuario_ibfk_2");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
