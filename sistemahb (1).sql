-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: mysql-1e7e449b-sistemahb.g.aivencloud.com:13585
-- Tiempo de generación: 14-10-2026 a las 15:12:12
-- Versión del servidor: 8.4.8
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `sistemahb`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `administrador`
--

CREATE TABLE `administrador` (
  `id_administrador` int NOT NULL,
  `id_persona` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `ciudad`
--

CREATE TABLE `ciudad` (
  `id_ciudad` int NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `altitud` decimal(10,2) NOT NULL,
  `id_departamento` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `correos_electronicos`
--

CREATE TABLE `correos_electronicos` (
  `id_correo_electronico` int NOT NULL,
  `correo_electronico` varchar(250) DEFAULT NULL,
  `contraseña` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `departamentos`
--

CREATE TABLE `departamentos` (
  `id_departamento` int NOT NULL,
  `departamento` varchar(200) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `edad_predeterminada`
--

CREATE TABLE `edad_predeterminada` (
  `id_edad` int NOT NULL,
  `edad` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `especialidades`
--

CREATE TABLE `especialidades` (
  `id_especialidad` int NOT NULL,
  `nombre` varchar(200) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `fecha_nacimiento`
--

CREATE TABLE `fecha_nacimiento` (
  `id_fecha_nacimiento` int NOT NULL,
  `fecha_de_nacimiento` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `genero`
--

CREATE TABLE `genero` (
  `id_genero` int NOT NULL,
  `nombre` enum('Masculino','Femenino') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `medico`
--

CREATE TABLE `medico` (
  `id_medico` int NOT NULL,
  `id_persona` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `medico_especialidad`
--

CREATE TABLE `medico_especialidad` (
  `id_medico_especialidad` int NOT NULL,
  `id_medico` int DEFAULT NULL,
  `id_especialidad` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `nivel_hemoglobina`
--

CREATE TABLE `nivel_hemoglobina` (
  `id_nivel` int NOT NULL,
  `id_usuario` int NOT NULL,
  `id_rango_hemoglobina` int NOT NULL,
  `valor_hemoglobina` decimal(4,2) NOT NULL,
  `temperatura` decimal(5,2) NOT NULL,
  `fecha_analisis` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `observaciones_clinica`
--

CREATE TABLE `observaciones_clinica` (
  `id_observacion` int NOT NULL,
  `observacion` varchar(150) NOT NULL,
  `descripcion` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `paciente_administrador`
--

CREATE TABLE `paciente_administrador` (
  `id_usuario_administrador` int NOT NULL,
  `id_usuario` int DEFAULT NULL,
  `id_administrador` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `paciente_medico`
--

CREATE TABLE `paciente_medico` (
  `id_usuario_medico` int NOT NULL,
  `id_usuario` int DEFAULT NULL,
  `id_medico` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `persona`
--

CREATE TABLE `persona` (
  `id_persona` int NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `paterno` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `materno` varchar(100) NOT NULL,
  `id_fecha_nacimiento` int DEFAULT NULL,
  `id_correo_electronico` int DEFAULT NULL,
  `id_genero` int NOT NULL,
  `id_ciudad` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `rango_hemoglobina`
--

CREATE TABLE `rango_hemoglobina` (
  `id_rango` int NOT NULL,
  `id_ciudad` int NOT NULL,
  `id_genero` int NOT NULL,
  `valor_min` decimal(4,2) NOT NULL,
  `valor_max` decimal(4,2) NOT NULL,
  `id_edad` int NOT NULL,
  `id_observacion` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `tipo_sangre`
--

CREATE TABLE `tipo_sangre` (
  `id_tipo_sangre` int NOT NULL,
  `tipo_de_sangre` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuario`
--

CREATE TABLE `usuario` (
  `id_usuario` int NOT NULL,
  `id_persona` int DEFAULT NULL,
  `id_tipo_sangre` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `administrador`
--
ALTER TABLE `administrador`
  ADD PRIMARY KEY (`id_administrador`),
  ADD KEY `id_persona` (`id_persona`);

--
-- Indices de la tabla `ciudad`
--
ALTER TABLE `ciudad`
  ADD PRIMARY KEY (`id_ciudad`),
  ADD KEY `id_departamento` (`id_departamento`);

--
-- Indices de la tabla `correos_electronicos`
--
ALTER TABLE `correos_electronicos`
  ADD PRIMARY KEY (`id_correo_electronico`),
  ADD UNIQUE KEY `correo_electronico` (`correo_electronico`);

--
-- Indices de la tabla `departamentos`
--
ALTER TABLE `departamentos`
  ADD PRIMARY KEY (`id_departamento`);

--
-- Indices de la tabla `edad_predeterminada`
--
ALTER TABLE `edad_predeterminada`
  ADD PRIMARY KEY (`id_edad`);

--
-- Indices de la tabla `especialidades`
--
ALTER TABLE `especialidades`
  ADD PRIMARY KEY (`id_especialidad`);

--
-- Indices de la tabla `fecha_nacimiento`
--
ALTER TABLE `fecha_nacimiento`
  ADD PRIMARY KEY (`id_fecha_nacimiento`);

--
-- Indices de la tabla `genero`
--
ALTER TABLE `genero`
  ADD PRIMARY KEY (`id_genero`),
  ADD UNIQUE KEY `nombre` (`nombre`);

--
-- Indices de la tabla `medico`
--
ALTER TABLE `medico`
  ADD PRIMARY KEY (`id_medico`),
  ADD KEY `id_persona` (`id_persona`);

--
-- Indices de la tabla `medico_especialidad`
--
ALTER TABLE `medico_especialidad`
  ADD PRIMARY KEY (`id_medico_especialidad`),
  ADD KEY `id_medico` (`id_medico`),
  ADD KEY `id_especialidad` (`id_especialidad`);

--
-- Indices de la tabla `nivel_hemoglobina`
--
ALTER TABLE `nivel_hemoglobina`
  ADD PRIMARY KEY (`id_nivel`),
  ADD KEY `id_usuario` (`id_usuario`),
  ADD KEY `id_rango_hemoglobina` (`id_rango_hemoglobina`);

--
-- Indices de la tabla `observaciones_clinica`
--
ALTER TABLE `observaciones_clinica`
  ADD PRIMARY KEY (`id_observacion`);

--
-- Indices de la tabla `paciente_administrador`
--
ALTER TABLE `paciente_administrador`
  ADD PRIMARY KEY (`id_usuario_administrador`),
  ADD KEY `id_usuario` (`id_usuario`),
  ADD KEY `id_administrador` (`id_administrador`);

--
-- Indices de la tabla `paciente_medico`
--
ALTER TABLE `paciente_medico`
  ADD PRIMARY KEY (`id_usuario_medico`),
  ADD KEY `id_usuario` (`id_usuario`),
  ADD KEY `id_medico` (`id_medico`);

--
-- Indices de la tabla `persona`
--
ALTER TABLE `persona`
  ADD PRIMARY KEY (`id_persona`),
  ADD KEY `id_fecha_nacimiento` (`id_fecha_nacimiento`),
  ADD KEY `id_correo_electronico` (`id_correo_electronico`),
  ADD KEY `id_genero` (`id_genero`),
  ADD KEY `fk_persona_ciudad` (`id_ciudad`);

--
-- Indices de la tabla `rango_hemoglobina`
--
ALTER TABLE `rango_hemoglobina`
  ADD PRIMARY KEY (`id_rango`),
  ADD KEY `id_ciudad` (`id_ciudad`),
  ADD KEY `id_genero` (`id_genero`),
  ADD KEY `fk_edad_rango_hemoglobina` (`id_edad`),
  ADD KEY `fk_observacio_rango` (`id_observacion`);

--
-- Indices de la tabla `tipo_sangre`
--
ALTER TABLE `tipo_sangre`
  ADD PRIMARY KEY (`id_tipo_sangre`);

--
-- Indices de la tabla `usuario`
--
ALTER TABLE `usuario`
  ADD PRIMARY KEY (`id_usuario`),
  ADD KEY `id_persona` (`id_persona`),
  ADD KEY `id_tipo_sangre` (`id_tipo_sangre`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `administrador`
--
ALTER TABLE `administrador`
  MODIFY `id_administrador` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `ciudad`
--
ALTER TABLE `ciudad`
  MODIFY `id_ciudad` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `correos_electronicos`
--
ALTER TABLE `correos_electronicos`
  MODIFY `id_correo_electronico` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `departamentos`
--
ALTER TABLE `departamentos`
  MODIFY `id_departamento` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `edad_predeterminada`
--
ALTER TABLE `edad_predeterminada`
  MODIFY `id_edad` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `fecha_nacimiento`
--
ALTER TABLE `fecha_nacimiento`
  MODIFY `id_fecha_nacimiento` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `genero`
--
ALTER TABLE `genero`
  MODIFY `id_genero` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `medico`
--
ALTER TABLE `medico`
  MODIFY `id_medico` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `medico_especialidad`
--
ALTER TABLE `medico_especialidad`
  MODIFY `id_medico_especialidad` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `nivel_hemoglobina`
--
ALTER TABLE `nivel_hemoglobina`
  MODIFY `id_nivel` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `observaciones_clinica`
--
ALTER TABLE `observaciones_clinica`
  MODIFY `id_observacion` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `paciente_administrador`
--
ALTER TABLE `paciente_administrador`
  MODIFY `id_usuario_administrador` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `paciente_medico`
--
ALTER TABLE `paciente_medico`
  MODIFY `id_usuario_medico` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `persona`
--
ALTER TABLE `persona`
  MODIFY `id_persona` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `rango_hemoglobina`
--
ALTER TABLE `rango_hemoglobina`
  MODIFY `id_rango` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `tipo_sangre`
--
ALTER TABLE `tipo_sangre`
  MODIFY `id_tipo_sangre` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `usuario`
--
ALTER TABLE `usuario`
  MODIFY `id_usuario` int NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `administrador`
--
ALTER TABLE `administrador`
  ADD CONSTRAINT `administrador_ibfk_1` FOREIGN KEY (`id_persona`) REFERENCES `persona` (`id_persona`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `ciudad`
--
ALTER TABLE `ciudad`
  ADD CONSTRAINT `ciudad_ibfk_1` FOREIGN KEY (`id_departamento`) REFERENCES `departamentos` (`id_departamento`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `medico`
--
ALTER TABLE `medico`
  ADD CONSTRAINT `medico_ibfk_1` FOREIGN KEY (`id_persona`) REFERENCES `persona` (`id_persona`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `medico_especialidad`
--
ALTER TABLE `medico_especialidad`
  ADD CONSTRAINT `medico_especialidad_ibfk_1` FOREIGN KEY (`id_medico`) REFERENCES `medico` (`id_medico`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `medico_especialidad_ibfk_2` FOREIGN KEY (`id_especialidad`) REFERENCES `especialidades` (`id_especialidad`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `nivel_hemoglobina`
--
ALTER TABLE `nivel_hemoglobina`
  ADD CONSTRAINT `nivel_hemoglobina_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `nivel_hemoglobina_ibfk_2` FOREIGN KEY (`id_rango_hemoglobina`) REFERENCES `rango_hemoglobina` (`id_rango`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `paciente_administrador`
--
ALTER TABLE `paciente_administrador`
  ADD CONSTRAINT `paciente_administrador_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `paciente_administrador_ibfk_2` FOREIGN KEY (`id_administrador`) REFERENCES `administrador` (`id_administrador`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `paciente_medico`
--
ALTER TABLE `paciente_medico`
  ADD CONSTRAINT `paciente_medico_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `paciente_medico_ibfk_2` FOREIGN KEY (`id_medico`) REFERENCES `medico` (`id_medico`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `persona`
--
ALTER TABLE `persona`
  ADD CONSTRAINT `fk_persona_ciudad` FOREIGN KEY (`id_ciudad`) REFERENCES `ciudad` (`id_ciudad`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `persona_ibfk_1` FOREIGN KEY (`id_fecha_nacimiento`) REFERENCES `fecha_nacimiento` (`id_fecha_nacimiento`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `persona_ibfk_2` FOREIGN KEY (`id_correo_electronico`) REFERENCES `correos_electronicos` (`id_correo_electronico`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `persona_ibfk_3` FOREIGN KEY (`id_genero`) REFERENCES `genero` (`id_genero`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `rango_hemoglobina`
--
ALTER TABLE `rango_hemoglobina`
  ADD CONSTRAINT `fk_edad_rango_hemoglobina` FOREIGN KEY (`id_edad`) REFERENCES `edad_predeterminada` (`id_edad`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_observacio_rango` FOREIGN KEY (`id_observacion`) REFERENCES `observaciones_clinica` (`id_observacion`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `rango_hemoglobina_ibfk_1` FOREIGN KEY (`id_ciudad`) REFERENCES `ciudad` (`id_ciudad`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `rango_hemoglobina_ibfk_2` FOREIGN KEY (`id_genero`) REFERENCES `genero` (`id_genero`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `usuario`
--
ALTER TABLE `usuario`
  ADD CONSTRAINT `usuario_ibfk_1` FOREIGN KEY (`id_persona`) REFERENCES `persona` (`id_persona`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `usuario_ibfk_2` FOREIGN KEY (`id_tipo_sangre`) REFERENCES `tipo_sangre` (`id_tipo_sangre`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
