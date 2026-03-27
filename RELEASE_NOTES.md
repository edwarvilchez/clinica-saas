# Release Notes - Clinica SaaS v1.1.0 (Demo Ready)

## 🌎 Internacionalización (i18n) Completa
- **Diccionarios Pulidos:** Revisión masiva de `ES_DICT` y `EN_DICT` en el `LanguageService`.
- **Nuevos Módulos Traducidos:**
  - Gestión de Especialistas (Doctores y Enfermeras).
  - Resultados de Laboratorio (Hematología, Química, etc.).
  - Guía Farmacéutica (Buscador y Administración de Fármacos).
  - Configuración y Perfil de Usuario.
- **Limpieza de UI:** Eliminación de todas las etiquetas técnicas (`raw keys`) en el Dashboard, Navbar y Sidebars.

## 💰 Reactividad Financiera (Dólares & Bolívares)
- **Currency Service Integrado:** El selector de moneda en el Navbar ahora es global y reactivo.
- **Formateo Dinámico:** Todos los montos en el Dashboard (Ingresos mensuales, etc.) y en el Catálogo de Laboratorio se convierten automáticamente según la tasa BCV del día.
- **Precisión Local:** Los precios en el catálogo de laboratorio ahora muestran el desglose en bolívares calculado en tiempo real.

## 🏥 Historial Médico Dinámico
- **Pestaña de Tratamientos:** Implementación del generador automático de recetas basado en consultas previas.
- **Pestaña de Laboratorio:** Mejoras en la visualización de resultados con indicadores de estado ("Listo").
- **Modal de Nueva Consulta:** Integración completa de:
  - Examen físico y Diagnóstico.
  - Generador de Receta Médica (Rp) con buscador de fármacos.
  - Gestión de Reposos Médicos con autocalculo de fechas (Inicio/Fin).
- **Control de Flujo:** Botón "Cambiar Paciente" totalmente funcional que limpia el estado y la URL.

## 🚀 Estabilización & UI/UX
- **Inicialización Global:** Corrección en `app.ts` para asegurar que las tasas de cambio se hidraten al arrancar la app.
- **Typing Fixes:** Resolvimos errores de tipos en la interfaz `Drug` y sus componentes relacionados.
- **Premium Design:** Ajustes de estilos en el Navbar y modales para mantener la coherencia con el diseño de alta gama.

---
**Preparado para la Demo por Antigravity (Advanced Agentic Coding Team)**
