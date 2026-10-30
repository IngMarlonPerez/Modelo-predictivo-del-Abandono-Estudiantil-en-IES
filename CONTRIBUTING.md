# Cómo contribuir

Gracias por el interés en mejorar este sistema de alerta temprana del abandono estudiantil.

## Flujo de ramas

```
fork ──PR──▶ contribuciones ──PR──▶ pruebas ──PR──▶ main
                 devmarlon ──PR──▶ pruebas
```

- **`main`**: producción. Solo recibe cambios desde `pruebas`.
- **`pruebas`**: integración. Solo recibe cambios desde `devmarlon` o `contribuciones`.
- **`contribuciones`**: entrada de aportes externos. El autor revisa cada commit antes de pasarlo a `pruebas`.

Ninguna rama admite envíos directos de terceros: todo cambio entra por pull request y debe pasar la integración continua (pruebas del backend y del frontend, validación de Docker Compose y origen del pull request).

## Pasos

1. Haga un fork del repositorio y cree una rama desde `contribuciones`.
2. Levante el sistema con `npm run dev` y ejecute `npm test`.
3. Abra un pull request **hacia `contribuciones`** describiendo qué cambia, por qué y cómo lo probó.

## Reglas

- No incluya credenciales, archivos `.env`, datos personales reales ni el conjunto OULAD.
- Mensajes de commit en español, en modo imperativo y describiendo el cambio.
- Los modelos de `backend/ml/modelos` solo se reentrenan con autorización del autor: sus métricas respaldan el trabajo de titulación.
