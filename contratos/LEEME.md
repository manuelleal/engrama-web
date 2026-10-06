# contratos/

Copias de **solo lectura** del contrato de `engrama-backend` contra las que el mock se valida (R2, R3).

- `openapi_c7a8b89.json`: exportación del OpenAPI del backend en `c7a8b89` (antes del login piloto).
- `adenda_login_piloto.json`: **escrita a mano**, no exportada. Describe `ProfileOut` y `MembershipOut` con los campos
  nuevos del login piloto (`active_tenant_id`, `must_change_password`, `memberships[].full_name`), el cuerpo de
  `POST /auth/contrasena` y los 403 de la espec. Sale de leer `engrama-backend/src/auth/schemas.py` en `7e69e3e`
  y de `docs/ESPEC_login_piloto.md` del backend. No se ejecutó el backend para hacerla.

## Pendiente (anotado, no hecho)

Exportar el OpenAPI real del backend final y reemplazar la adenda. La instrucción de la espec (§9.2) es, con el `.venv`
oficial y sin modificar nada:

    python -c "import json; from src.main import app; print(json.dumps(app.openapi(), sort_keys=True))"

Al hacerlo: guardar como `contratos/openapi_<sha>.json`, borrar `openapi_c7a8b89.json` y la adenda, y apuntar R2/R3
(`tests/contrato/`) al archivo nuevo. Si R3 se pone rojo con la exportación real, la adenda estaba mal y el mock se corrige.
