# Figma Foundry Guardian - Historial de Desarrollo

Este documento detalla la evolución del plugin a lo largo de las decisiones de diseño tomadas durante la sesión de pair programming.

## 1. El Objetivo Inicial
El usuario necesitaba transformar un detector de componentes básico en un **Motor de Gobernanza de Diseño** completo con 3 capacidades:
- **Linter de Tokens de Diseño:** Detectar espaciados y paddings que no coincidan con la escala oficial (FOUNDRY_SPACING_SCALE).
- **Gestión de Librerías (Componentes):** Marcar cualquier componente externo como rojo ("Legacy") si no pertenece a la base de Foundry. 
- **Auditoría de Iconografía:** Identificar el uso de íconos que no provienen de la librería "Foundry Icons".

## 2. Iteraciones y Arquitectura

### 2.1 Refactor del Orquestador
Inicialmente, el proyecto intentó usar múltiples agentes asincrónicos ("syncAgent", etc). Sin embargo, Figma impone restricciones de ejecución y no tolera workers pesados corriendo infinitamente sin UI callbacks.
- **Decisión:** Se reescribió `main.ts` como un "single-file orchestrator". Todas las llamadas a la API de Figma se ejecutan directamente alineadas, simplificando la arquitectura a 5 archivos estáticos de Typescript y 1 HTML.

### 2.2 Reemplazo de Keys Stale por JSON Sources
El archivo `foundryLibrary.ts` poseía más de 12,000 entradas generadas antiguamente y llenas de "variantes". Generaba falsos positivos porque no matcheaban a los componentes master.
- **Decisión:** Se borró `foundryLibrary.ts` y mediante Vite se integraron al build nativo los 3 archivos crudos: `keysFoundry.json`, `keysFoundryIcons.json` y `keysFoundryTokens.json` (aprox. 4000 keys).

### 2.3 Solución para Componentes Faltantes: El Key Extractor
Muchos componentes (ej: "Accordion") no estaban ni siquiera en los JSON base de Figma provistos por el usuario. No se podía hacer un hardcode.
- **Decisión:** Se construyó un **Extractor Dinámico** con protección por contraseña (`Foundry123$`). Al entrar a la librería maestra en Figma, el usuario puede correr el "Extractor" para robar todas las keys nativas, guardarlas en el `clientStorage` de Figma, y que de ahora en más el plugin las use para validar automáticamente en los siguientes scans.
- **Capa Extra:** Se agregó una 4ta capa de escaneo que compara también el nombre del Parent Component (`COMPONENT_SET`), no solamente el nodo particular, ya que a veces las instancias devuelven keys de variantes que no teníamos en la base.

### 2.4 Mega-Optimización del Scanner (Congelamiento de Figma)
En archivos grandes, el plugin freezaba toda la interfaz de Figma o crasheaba silenciosamente y se quedaba diciendo "Scanning...".
¿Por qué? Porque iteraba `findAll` e intentaba el método `await node.getMainComponentAsync()` 5,000 veces seguidas, además de hacerlo *dos veces* (una para Componentes, otra para Íconos).
- **Resolución 1 (Fusión):** Se fusionaron los bucles de auditoría de Componentes e Íconos a una sola iteración de código `O(N)`.
- **Resolución 2 (Lookup Nativo):** Se priorizó la propiedad síncrona `node.mainComponent` para el 99% de los casos, dejando la versión asincrónica solo para componentes remotos sin cachear.
- **Resolución 3 (Respiración de Hilo):** Se programó un *event-loop yield* con `await new Promise(r => setTimeout(r, 1))` cada 100 iteraciones para no bloquear el framerate de la aplicación nativa de Figma.
- **Resolución 4 (Crasheo Silencioso):** Se detectaron *event listeners* huérfanos en `ui.html` correspondientes a funciones borradas antes. Estos crasheaban el thread en línea 461, lo cual causaba que la UI jamás reciba el callback de que el backend había terminado el scan.

## 3. Estado Actual
El plugin cuenta con:
- Main unificado hiper-optimizado (~150ms build time con Vite).
- Interfaz moderna en HTML/CSS vanilla de bajo peso, con panel táctico de 5 tabs.
- Scanner dinámico instantáneo y seguro a través de contraseñas.
- Peso en bundle final comprimido: 556 KB.
