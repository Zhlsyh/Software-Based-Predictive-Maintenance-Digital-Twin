import time
import math
import random
import json
import paho.mqtt.client as mqtt

# ----------------------------------------------------
# Konfigurasi MQTT Broker (Menggunakan Broker Publik)
# ----------------------------------------------------
MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883
MQTT_TOPIC = "industrial/machine/telemetry"

client = mqtt.Client()

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("[SUCCESS] Terhubung ke MQTT Broker HiveMQ")
    else:
        print(f"[ERROR] Gagal terhubung, kode status: {rc}")

client.on_connect = on_connect
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_start()

print("=== Starting Predictive Maintenance Telemetry Generator ===")

t = 0
try:
    while True:
        # 1. Simulasi matematika data telemetri (Suara/Noise + Trend Suhu Naik-Turun)
        vibration = abs(math.sin(t * 0.1) * 10 + random.uniform(-1.5, 1.5))
        temperature = 35.0 + (t * 0.25) % 45  # Suhu bergerak dari 35°C - 80°C
        rpm = 1500 + int(math.sin(t * 0.05) * 250)

        # 2. Penentuan Status Kesehatan Mesin (Predictive Thresholds)
        status = "HEALTHY"
        if temperature > 70.0 or vibration > 9.0:
            status = "CRITICAL"
        elif temperature > 55.0 or vibration > 6.0:
            status = "WARNING"

        # 3. Packaging Data JSON
        payload = {
            "temperature": round(temperature, 2),
            "vibration": round(vibration, 2),
            "rpm": rpm,
            "status": status,
            "timestamp": int(time.time())
        }

        # 4. Kirim Data via Protocol MQTT
        client.publish(MQTT_TOPIC, json.dumps(payload))
        print(f"[TELEMETRY] Temp: {payload['temperature']}°C | Vib: {payload['vibration']} m/s² | RPM: {payload['rpm']} | Status: {payload['status']}")

        t += 1
        time.sleep(0.5)  # Sampling rate kirim data tiap 500 ms

except KeyboardInterrupt:
    print("\n[STOP] Telemetry Generator dihentikan.")
    client.loop_stop()
    client.disconnect()