<div align="center">

# 🗄️ Base de datos

### Modelo relacional del Sistema Web de Monitoreo de Hemoglobina

<img src="https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL"/>
<img src="https://img.shields.io/badge/Tablas-18-success?style=for-the-badge" alt="18 tablas"/>
<img src="https://img.shields.io/badge/Modelo-Relacional-blueviolet?style=for-the-badge" alt="Modelo relacional"/>

[⬅️ Volver al README principal](../README.md)

</div>

---

## 📑 Contenido

- [🎯 Descripción](#-descripción)
- [🗺️ Diagrama entidad-relación](#️-diagrama-entidad-relación)
- [📋 Diccionario de datos](#-diccionario-de-datos)
- [🧠 Cómo funciona el modelo](#-cómo-funciona-el-modelo)
- [🚀 Instalación](#-instalación)
- [🔐 Seguridad](#-seguridad)

## 🎯 Descripción

La base de datos almacena a las **personas** del sistema y sus tres roles (**paciente/usuario**, **médico** y **administrador**), junto con las **mediciones de hemoglobina** y los **rangos de referencia** con los que se interpretan. Está normalizada: ciudades, géneros, fechas de nacimiento, correos y tipos de sangre viven en tablas propias.

## 🗺️ Diagrama entidad-relación

```mermaid
erDiagram
    departamentos ||--o{ ciudad : "tiene"
    ciudad ||--o{ persona : "reside en"
    genero ||--o{ persona : "define"
    fecha_nacimiento ||--o| persona : "pertenece a"
    correos_electronicos ||--o| persona : "pertenece a"

    persona ||--o| usuario : "es"
    persona ||--o| medico : "es"
    persona ||--o| administrador : "es"
    tipo_sangre ||--o{ usuario : "tiene"

    medico ||--o{ medico_especialidad : "posee"
    especialidades ||--o{ medico_especialidad : "asignada a"

    usuario ||--o{ paciente_medico : "atendido por"
    medico ||--o{ paciente_medico : "atiende"
    usuario ||--o{ paciente_administrador : "gestionado por"
    administrador ||--o{ paciente_administrador : "gestiona"

    usuario ||--o{ nivel_hemoglobina : "registra"
    rango_hemoglobina ||--o{ nivel_hemoglobina : "clasifica"
    ciudad ||--o{ rango_hemoglobina : "aplica a"
    genero ||--o{ rango_hemoglobina : "aplica a"
    edad_predeterminada ||--o{ rango_hemoglobina : "aplica a"
    observaciones_clinica ||--o{ rango_hemoglobina : "describe"

    departamentos {
        int id_departamento PK
        varchar departamento
    }
    ciudad {
        int id_ciudad PK
        varchar nombre
        decimal altitud
        int id_departamento FK
    }
    genero {
        int id_genero PK
        enum nombre
    }
    fecha_nacimiento {
        int id_fecha_nacimiento PK
        date fecha_de_nacimiento
    }
    correos_electronicos {
        int id_correo_electronico PK
        varchar correo
        text contrasena
    }
    persona {
        int id_persona PK
        varchar nombre
        varchar paterno
        varchar materno
        int id_fecha_nacimiento FK
        int id_correo_electronico FK
        int id_genero FK
        int id_ciudad FK
    }
    tipo_sangre {
        int id_tipo_sangre PK
        varchar tipo_de_sangre
    }
    usuario {
        int id_usuario PK
        int id_persona FK
        int id_tipo_sangre FK
    }
    medico {
        int id_medico PK
        int id_persona FK
    }
    administrador {
        int id_administrador PK
        int id_persona FK
    }
    especialidades {
        int id_especialidad PK
        varchar nombre
    }
    medico_especialidad {
        int id_medico_especialidad PK
        int id_medico FK
        int id_especialidad FK
    }
    paciente_medico {
        int id_usuario_medico PK
        int id_usuario FK
        int id_medico FK
    }
    paciente_administrador {
        int id_usuario_administrador PK
        int id_usuario FK
        int id_administrador FK
    }
    edad_predeterminada {
        int id_edad PK
        int edad
    }
    observaciones_clinica {
        int id_observacion PK
        varchar observacion
        text descripcion
    }
    rango_hemoglobina {
        int id_rango PK
        int id_ciudad FK
        int id_genero FK
        decimal valor_min
        decimal valor_max
        int id_edad FK
        int id_observacion FK
    }
    nivel_hemoglobina {
        int id_nivel PK
        int id_usuario FK
        int id_rango_hemoglobina FK
        decimal valor_hemoglobina
        decimal temperatura
        date fecha_analisis
    }
```

## 📋 Diccionario de datos

### 👤 Personas y roles

| Tabla | Campos | Descripción |
|---|---|---|
| 🧑 **persona** | `id_persona` PK · `nombre` · `paterno` · `materno` · `id_fecha_nacimiento` FK · `id_correo_electronico` FK · `id_genero` FK · `id_ciudad` FK | Datos personales comunes a todos los roles |
| 🤒 **usuario** | `id_usuario` PK · `id_persona` FK · `id_tipo_sangre` FK | Rol de **paciente** |
| 🩺 **medico** | `id_medico` PK · `id_persona` FK | Rol de **médico** |
| 🛡️ **administrador** | `id_administrador` PK · `id_persona` FK | Rol de **administrador** |

### 🔗 Relaciones entre roles

| Tabla | Campos | Descripción |
|---|---|---|
| 🤝 **paciente_medico** | `id_usuario_medico` PK · `id_usuario` FK · `id_medico` FK | Qué médico atiende a cada paciente |
| 🤝 **paciente_administrador** | `id_usuario_administrador` PK · `id_usuario` FK · `id_administrador` FK | Qué administrador gestiona a cada paciente |
| 🎓 **medico_especialidad** | `id_medico_especialidad` PK · `id_medico` FK · `id_especialidad` FK | Especialidades de cada médico (N:M) |

### 📇 Catálogos

| Tabla | Campos | Descripción |
|---|---|---|
| 🎓 **especialidades** | `id_especialidad` PK · `nombre` VARCHAR(200) | Especialidades médicas |
| 🏙️ **ciudad** | `id_ciudad` PK · `nombre` VARCHAR(100) · `altitud` DECIMAL(10,2) · `id_departamento` FK | Ciudades con su altitud |
| 🗺️ **departamentos** | `id_departamento` PK · `departamento` VARCHAR(200) | Departamentos |
| ⚧️ **genero** | `id_genero` PK · `nombre` ENUM | Géneros |
| 🎂 **fecha_nacimiento** | `id_fecha_nacimiento` PK · `fecha_de_nacimiento` DATE | Fechas de nacimiento |
| 📧 **correos_electronicos** | `id_correo_electronico` PK · `correo` VARCHAR(250) · `contraseña` TEXT | Credenciales de acceso |
| 🩸 **tipo_sangre** | `id_tipo_sangre` PK · `tipo_de_sangre` VARCHAR(100) | Grupos sanguíneos |
| 📅 **edad_predeterminada** | `id_edad` PK · `edad` INTEGER | Edades de referencia para los rangos |

### 🔬 Hemoglobina

| Tabla | Campos | Descripción |
|---|---|---|
| 📏 **rango_hemoglobina** | `id_rango` PK · `id_ciudad` FK · `id_genero` FK · `valor_min` DECIMAL(4,2) · `valor_max` DECIMAL(4,2) · `id_edad` FK · `id_observacion` FK | Rango normal según ciudad, género y edad |
| 📝 **observaciones_clinica** | `id_observacion` PK · `observacion` VARCHAR(150) · `descripcion` TEXT | Interpretación clínica asociada a un rango |
| 📈 **nivel_hemoglobina** | `id_nivel` PK · `id_usuario` FK · `id_rango_hemoglobina` FK · `valor_hemoglobina` DECIMAL(4,2) · `temperatura` DECIMAL(5,2) · `fecha_analisis` DATE | Cada medición de un paciente |

## 🧠 Cómo funciona el modelo

1. Toda persona se registra en **`persona`**, con su ciudad, género, fecha de nacimiento y correo.
2. Según su rol, se crea un registro en **`usuario`** (paciente), **`medico`** o **`administrador`**.
3. Cada medición se guarda en **`nivel_hemoglobina`** y se enlaza a un **`rango_hemoglobina`**.
4. El rango depende de **ciudad** (por la altitud), **género** y **edad**, y trae una **observación clínica** que ayuda a detectar anemia o poliglobulia.

> [!TIP]
> Incluir la **altitud** de la ciudad es clave: a mayor altura, los valores normales de hemoglobina son más altos.

## 🚀 Instalación

1. Instala **MySQL** y un gestor (MySQL Workbench, DBeaver o similar).
2. Ejecuta el script de creación:
   ```bash
   mysql -u <usuario> -p < schema.sql
   ```
3. Configura el [backend](../backend/) con tu cadena de conexión **local**.

El script [`schema.sql`](schema.sql) crea las 18 tablas en el orden correcto de dependencias.

## 🔐 Seguridad

> [!WARNING]
> La columna `contraseña` es de tipo `TEXT`. **Nunca guardes contraseñas en texto plano**: almacena solo un *hash* con sal (por ejemplo, BCrypt o PBKDF2 en ASP.NET Core).

- 🚫 No publiques cadenas de conexión con credenciales.
- 🔧 Usa variables de entorno o un archivo local excluido con `.gitignore`.
- 🧪 Usa datos de prueba; los datos de salud reales son sensibles.

<div align="center">

---
[⬅️ Volver al README principal](../README.md)

</div>
