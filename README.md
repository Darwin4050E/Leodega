# LEODEGA

Leodega es una plataforma web full‑stack para la gestión y alquiler de bodegas y espacios de almacenamiento. 
El proyecto fue desarrollado con fines académicos en la asignatura Ingeniería de Software II (Soft II).

El sistema permite conectar propietarios de bodegas con arrendatarios, facilitando la publicación de espacios, la gestión de reservas y la comunicación entre los usuarios.

---

## Funcionalidades

* Autenticación y autorización mediante Laravel Sanctum
* Gestión de usuarios con roles (Administrador, Propietario, Arrendatario)
* Registro y administración de bodegas
* Gestión de reservas
* Sistema de notificaciones
* Visualización de bodegas en mapa mediante Leaflet
* API REST
* Contenerización con Docker Compose


## Tecnologías utilizadas

### Frontend
* React 19

### Backend
* Laravel 12
* Base de datos relacional (PostgreSQL / SQLite en desarrollo)


## Roles del sistema

| Rol           | Descripción                          |
| ------------- | ------------------------------------ |
| Administrador | Gestión general del sistema          |
| Propietario   | Registro y administración de bodegas |
| Arrendatario  | Consulta y reserva de bodegas        |

## Seguridad

* Autenticación basada en tokens
* Protección de rutas por rol
* Validación de datos en el backend
* Manejo de CORS



## Metodología

El desarrollo del proyecto se realizó bajo la metodología Scrum, utilizando product backlog, sprints, revisiones y retrospectivas.


## Estado del proyecto

En desarrollo. Fase de integración y pruebas.




