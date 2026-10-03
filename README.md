# ⚙️️ Software-Based Predictive Maintenance Digital Twin

![Python](https://img.shields.io/badge/Python-3.10-blue.svg)
![Three.js](https://img.shields.io/badge/Three.js-3D%20Visualization-black.svg)
![MQTT](https://img.shields.io/badge/MQTT-HiveMQ%20Broker-orange.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

Proyek pemantauan kondisi kesehatan mesin industri secara *real-time* berbasis **Digital Twin**. Proyek ini berjalan 100% secara *software-only* di komputer/laptop menggunakan kombinasi **Python** (Data Generator), **MQTT Broker**, dan **Three.js** (Dashboard Visualizer 3D).

---

## 🏗️ Architecture & Data Flow
```text
[ Python Data Generator ] ──(MQTT/JSON)──> [ HiveMQ Broker ] ──(WebSockets)──> [ Three.js 3D Dashboard ]