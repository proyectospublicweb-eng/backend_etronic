# ⚙️ Reglas de Proceso — Etronic (`etronic.com.mx`)

Este documento define las reglas operativas obligatorias para el asistente al realizar cualquier implementación, cambio o ajuste en el proyecto:

1. **Prohibido ejecutar `git commit` y `git push` en automático**:
   - Nunca ejecutar `git commit` ni `git push` después de realizar un cambio, ajuste o actualización de bitácora, **a menos que el usuario lo solicite explícitamente** (por ejemplo: *"manda commit y push"*).
2. **Notificación obligatoria de estado de Git en cada ajuste**:
   - Al finalizar cualquier implementación o ajuste, **siempre notificar explícitamente al usuario que aún NO se ha enviado `commit` ni `push` a GitHub** (indicando que los cambios están aplicados localmente, pendientes de confirmación para subir al repositorio y desplegar en producción).
3. **Revisión al iniciar sesión / día**:
   - Al comenzar el día o cuando el usuario pida revisar la bitácora, consultar este archivo junto con los registros de `Backend/bitácora/` para mantener presentes todas las reglas y el contexto del proyecto.
4. **Registro diario en bitácora**:
   - Registrar en `Backend/bitácora/<YYYY-MM-DD>.md` cada implementación, modificación o ajuste realizado en el día con un breve resumen por punto.



