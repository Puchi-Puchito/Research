# Eventos, pauta OFF y Cencosud — Argentina

Mapa interactivo con eventos masivos de Argentina, las zonas de vía pública (OOH) que rodean cada sede y los supermercados de Cencosud (Jumbo, Disco y Vea) cercanos.

Para cada evento muestra:

- **Convocatoria publicada** de la última edición, con la unidad exacta de la fuente (personas, visitantes, espectadores, admisiones) y un nivel de confianza.
- **Próxima edición** y sede.
- **Zonas de pauta OFF** cercanas, con operador y formato.
- **Sucursales de Cencosud** dentro de un radio de 3 km (AMBA) o 15 km (interior), con su distancia en línea recta.

Datos al 21/10/2026.

## Cómo verlo

Publicado con GitHub Pages: <https://puchi-puchito.github.io/research/>

Para probarlo en tu computadora hace falta un servidor local (el mapa lee los archivos de `data/`):

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Google Maps

El mapa usa Google Maps cuando hay una clave configurada en `config.js`. Si no hay clave, usa calles de OpenStreetMap (vía CARTO).

1. En [Google Cloud Console](https://console.cloud.google.com/google/maps-apis) activá **Maps JavaScript API** y creá una clave.
2. Restringí la clave, porque queda visible en la página:
   - Restricción de aplicación: **Sitios web**, con `https://puchi-puchito.github.io/*` y, para pruebas, `http://localhost:8000/*`.
   - Restricción de API: sólo **Maps JavaScript API**.
3. Pegá la clave en `config.js`, en `GOOGLE_MAPS_API_KEY`.

## Datos

| Archivo | Contenido |
| --- | --- |
| `data/eventos.json` / `.csv` | 18 eventos y frentes: sede, coordenadas, convocatoria, unidad, confianza, próxima edición, fuente |
| `data/pauta_off.json` / `.csv` | 23 zonas de vía pública: operador, formato, ubicación de referencia, fuente |
| `data/cencosud.json` / `.csv` | 254 sucursales Jumbo, Disco y Vea con coordenadas |

Notas de método:

- **Convocatoria no es público único.** Muchas cifras son acumulados de varios días o visitas a un circuito; no se suman entre eventos.
- **Expectativa no es balance.** Cuando hay balance posterior al evento se usa ese; la expectativa previa se informa aparte.
- **Ubicaciones.** Tres sedes están verificadas con Wikipedia; el resto son aproximadas, con un margen de unos 300 m. Las zonas de pauta OFF son referencias de zona, no carteles exactos: la ubicación precisa de cada soporte la confirma el operador.
- **Cencosud.** Sólo incluye supermercados relevados por SEPA (Jumbo, Disco, Vea). Easy y Blaisten no figuran.

## Fuentes

- Sucursales: SEPA – Precios Claros (Ministerio de Economía), abril 2026, tomado del [mapa de precios minoristas de INECO-UADE](https://github.com/UADEINECO/mapa_precios_minoristas_ar).
- Convocatorias y fechas: balances de organizadores y organismos públicos y prensa; cada evento tiene su enlace en `data/eventos.json`.
- Pauta OFF: sitios de los operadores (Delfino Magnus, NVOOH, Outmark, Sarmiento, Atacama, 7Sentidos/Colosal, Taggify, Aeropuertos Argentina) y prensa; cada zona tiene su enlace en `data/pauta_off.json`.
- Mapa base: Google Maps, o © OpenStreetMap contributors © CARTO.
