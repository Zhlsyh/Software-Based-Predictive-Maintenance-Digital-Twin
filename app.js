const canvas = document.getElementById("machine-canvas");
    const stage = document.getElementById("stage");
    const connectionIndicator = document.getElementById("connection-indicator");
    const connectionText = document.getElementById("connection-text");
    const dataMessage = document.getElementById("data-message");
    const statusTag = document.getElementById("status-tag");
    const retryButton = document.getElementById("retry-connect");
    const trendLine = document.getElementById("trend-line");
    const trendEmpty = document.getElementById("trend-empty");
    const trendCount = document.getElementById("trend-count");
    const trendSummary = document.getElementById("trend-summary");
    const sampleTime = document.getElementById("sample-time");
    const vibrationSamples = [];
    const maxSamples = 32;

    function setConnectionState(state, message) {
      connectionIndicator.dataset.state = state;
      connectionText.textContent = message;
      retryButton.classList.toggle("visible", state === "error");
    }

    function reportTelemetryError(message, error, connectionFailed = true) {
      beltSpeed = 0;
      if (connectionFailed) setConnectionState("error", "Koneksi bermasalah");
      dataMessage.textContent = message;
      if (error) console.error("[TELEMETRY ERROR]", error);
    }

    // Three.js membangun model visual; MQTT memperbarui telemetry, bukan mengendalikan mesin fisik.
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x182127);
    scene.fog = new THREE.Fog(0x182127, 12, 24);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;

    scene.add(new THREE.HemisphereLight(0xc9d5dd, 0x303a40, 1.25));
    const keyLight = new THREE.DirectionalLight(0xffe5bc, 2.1);
    keyLight.position.set(4, 7, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x9aafba, 1.1);
    fillLight.position.set(-5, 3, -4);
    scene.add(fillLight);

    const machine = new THREE.Group();
    scene.add(machine);

    const materials = {
      body: new THREE.MeshStandardMaterial({ color: 0x65747b, metalness: 0.68, roughness: 0.4 }),
      motorBody: new THREE.MeshStandardMaterial({ color: 0x65747b, metalness: 0.68, roughness: 0.4 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: 0x35434a, metalness: 0.8, roughness: 0.32 }),
      brightMetal: new THREE.MeshStandardMaterial({ color: 0x9aa6a8, metalness: 0.86, roughness: 0.24 }),
      panel: new THREE.MeshStandardMaterial({ color: 0x8c7650, metalness: 0.56, roughness: 0.42 }),
      base: new THREE.MeshStandardMaterial({ color: 0x414d52, metalness: 0.62, roughness: 0.5 }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x242a2d, metalness: 0.18, roughness: 0.76 }),
      belt: new THREE.MeshStandardMaterial({ color: 0x292f32, metalness: 0.14, roughness: 0.86 }),
      beltSeam: new THREE.MeshStandardMaterial({ color: 0x424a4d, metalness: 0.24, roughness: 0.7 }),
      ground: new THREE.MeshStandardMaterial({ color: 0x252e33, metalness: 0.25, roughness: 0.82 })
    };

    function addBox(parent, width, height, depth, material, x, y, z) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    function addCylinder(parent, radiusTop, radiusBottom, length, material, x, y, z, axis = "x", segments = 40) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radiusTop, radiusBottom, length, segments),
        material
      );
      if (axis === "x") mesh.rotation.z = Math.PI / 2;
      if (axis === "z") mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    function addBolt(parent, x, y, z, radius = 0.04) {
      addCylinder(parent, radius, radius, 0.035, materials.brightMetal, x, y, z, "z", 8);
    }

    // Dimensi ini menentukan lintasan tertutup sabuk dan jarak antarsegmennya dalam unit Three.js.
    const beltSlats = [];
    const rollers = [];
    const conveyorHalfLength = 2.85;
    const beltRadius = 0.42;
    const beltCenterY = 1.21;
    const beltWidth = 1.55;
    const straightLength = conveyorHalfLength * 2;
    const curveLength = Math.PI * beltRadius;
    const beltLoopLength = straightLength * 2 + curveLength * 2;
    const beltSlatCount = 56;

    function addBeltSlat(index) {
      const material = index % 7 === 0 ? materials.beltSeam : materials.belt;
      const slat = addBox(machine, beltLoopLength / beltSlatCount * 0.98, 0.065, beltWidth, material, 0, 0, 0);
      beltSlats.push(slat);
      return slat;
    }

    function placeBeltSlat(slat, distance) {
      const offset = ((distance % beltLoopLength) + beltLoopLength) % beltLoopLength;
      let x;
      let y;
      let angle;

      // Posisi dihitung sepanjang sisi atas, lengkungan kanan, sisi bawah, lalu lengkungan kiri.
      if (offset < straightLength) {
        x = -conveyorHalfLength + offset;
        y = beltCenterY + beltRadius;
        angle = 0;
      } else if (offset < straightLength + curveLength) {
        const curveOffset = offset - straightLength;
        const curveAngle = Math.PI / 2 - curveOffset / beltRadius;
        x = conveyorHalfLength + beltRadius * Math.cos(curveAngle);
        y = beltCenterY + beltRadius * Math.sin(curveAngle);
        angle = curveAngle - Math.PI / 2;
      } else if (offset < straightLength * 2 + curveLength) {
        const runOffset = offset - straightLength - curveLength;
        x = conveyorHalfLength - runOffset;
        y = beltCenterY - beltRadius;
        angle = Math.PI;
      } else {
        const curveOffset = offset - straightLength * 2 - curveLength;
        const curveAngle = -Math.PI / 2 - curveOffset / beltRadius;
        x = -conveyorHalfLength + beltRadius * Math.cos(curveAngle);
        y = beltCenterY + beltRadius * Math.sin(curveAngle);
        angle = curveAngle - Math.PI / 2;
      }

      slat.position.set(x, y, 0);
      slat.rotation.z = angle;
    }

    // Rangka, kaki, dan palang silang menjadi penopang di bawah lintasan roller.
    addBox(machine, 7.25, 0.08, 3.15, materials.ground, 0, -0.1, 0);
    for (const z of [-0.88, 0.88]) {
      addBox(machine, 6.3, 0.2, 0.16, materials.darkMetal, 0, 0.91, z);
      addBox(machine, 6.05, 0.08, 0.1, materials.panel, 0, 1.08, z);
    }
    for (const x of [-2.25, 2.25]) {
      for (const z of [-0.72, 0.72]) {
        addBox(machine, 0.18, 1.05, 0.18, materials.body, x, 0.39, z);
        addBox(machine, 0.38, 0.12, 0.35, materials.base, x, -0.14, z);
        addBox(machine, 0.36, 0.04, 0.34, materials.rubber, x, -0.06, z);
      }
    }
    for (const x of [-1.1, 1.1]) {
      addBox(machine, 0.12, 0.46, 1.4, materials.base, x, 0.56, 0);
    }

    // Roller ujung membentang melintasi sabuk; fase putarnya diselaraskan dengan gerak sabuk.
    for (const x of [-conveyorHalfLength, conveyorHalfLength]) {
      addBox(machine, 0.62, 0.12, 1.7, materials.base, x, beltCenterY - 0.46, 0);
      const roller = new THREE.Group();
      roller.position.set(x, beltCenterY, 0);
      roller.rotation.x = Math.PI / 2;
      machine.add(roller);
      addCylinder(roller, beltRadius, beltRadius, beltWidth + 0.12, materials.darkMetal, 0, 0, 0, "y");
      addCylinder(roller, 0.11, 0.11, beltWidth + 0.3, materials.brightMetal, 0, 0, 0, "y", 24);
      for (const side of [-1, 1]) {
        const faceY = side * (beltWidth / 2 + 0.055);
        addCylinder(roller, 0.46, 0.46, 0.07, materials.body, 0, faceY, 0, "y");
        addCylinder(roller, 0.16, 0.16, 0.075, materials.brightMetal, 0, faceY + side * 0.06, 0, "y", 24);
        for (let spokeIndex = 0; spokeIndex < 4; spokeIndex += 1) {
          const angle = (spokeIndex / 4) * Math.PI * 2;
          const spoke = addBox(
            roller,
            0.24,
            0.035,
            0.035,
            materials.beltSeam,
            Math.cos(angle) * 0.29,
            faceY + side * 0.04,
            Math.sin(angle) * 0.29
          );
          spoke.rotation.y = -angle;
        }
      }
      rollers.push(roller);
    }

    // Segmen permukaan membuat arah gerak sabuk terlihat saat melewati roller.
    for (let index = 0; index < beltSlatCount; index += 1) {
      const slat = addBeltSlat(index);
      placeBeltSlat(slat, index / beltSlatCount * beltLoopLength);
    }

    // Motor bergigi dipasang di luar rangka pada ujung penggerak conveyor.
    addBox(machine, 1.45, 0.13, 0.16, materials.base, conveyorHalfLength, 0.61, 1.04);
    addCylinder(machine, 0.34, 0.34, 0.84, materials.motorBody, 3.05, 0.56, 1.45, "z");
    for (let index = 0; index < 7; index += 1) {
      const z = 1.1 + index * 0.1;
      addCylinder(machine, 0.38, 0.38, 0.045, materials.darkMetal, 3.05, 0.56, z, "z", 32);
    }
    for (const z of [1.0, 1.89]) {
      addCylinder(machine, 0.31, 0.31, 0.1, materials.darkMetal, 3.05, 0.56, z, "z");
    }
    addCylinder(machine, 0.12, 0.12, 0.16, materials.brightMetal, 2.75, 0.56, 0.96, "z", 24);
    addBox(machine, 0.42, 0.3, 0.38, materials.panel, 3.05, 0.95, 1.4);
    addBox(machine, 0.35, 0.045, 0.025, materials.brightMetal, 3.05, 0.95, 1.6);
    for (const x of [2.9, 3.2]) {
      for (const z of [1.25, 1.55]) addBolt(machine, x, 1.07, z, 0.025);
    }

    for (let index = 0; index < beltSlats.length; index += 1) {
      placeBeltSlat(beltSlats[index], index / beltSlatCount * beltLoopLength);
    }
    machine.position.y = 0.05;
    machine.rotation.y = -0.36;
    const cameraTarget = new THREE.Vector3(0.05, 0.67, 0);
    camera.position.set(6.4, 4.9, 9.3);
    camera.lookAt(cameraTarget);

    // beltDistance berulang untuk menempatkan segmen; beltTravel terus naik agar fase roller tidak meloncat.
    let beltSpeed = 0;
    let beltDistance = 0;
    let beltTravel = 0;
    const animationClock = new THREE.Clock();
    let dragPointer = null;
    let lastPointerX = 0;
    let lastPointerY = 0;

    function resizeRenderer() {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    new ResizeObserver(resizeRenderer).observe(stage);
    resizeRenderer();

    canvas.addEventListener("pointerdown", (event) => {
      dragPointer = event.pointerId;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (dragPointer !== event.pointerId) return;
      const deltaX = event.clientX - lastPointerX;
      const deltaY = event.clientY - lastPointerY;
      machine.rotation.y += deltaX * 0.008;
      machine.rotation.x = Math.max(-0.32, Math.min(0.32, machine.rotation.x + deltaY * 0.004));
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
    });

    canvas.addEventListener("pointerup", () => { dragPointer = null; });
    canvas.addEventListener("pointercancel", () => { dragPointer = null; });
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      camera.position.multiplyScalar(event.deltaY > 0 ? 1.07 : 0.935);
      camera.position.clampLength(5.2, 13);
      camera.lookAt(cameraTarget);
    }, { passive: false });

    document.getElementById("reset-view").addEventListener("click", () => {
      machine.rotation.set(0, -0.36, 0);
      camera.position.set(6.4, 4.9, 9.3);
      camera.lookAt(cameraTarget);
    });

    const toggleLabels = document.getElementById("toggle-labels");
    toggleLabels.addEventListener("click", () => {
      const hidden = stage.classList.toggle("labels-off");
      toggleLabels.textContent = hidden ? "Tampilkan label" : "Sembunyikan label";
      toggleLabels.setAttribute("aria-pressed", String(!hidden));
    });

    function animate() {
      requestAnimationFrame(animate);
      const delta = Math.min(animationClock.getDelta(), 0.05);
      beltTravel += beltSpeed * delta;
      beltDistance = beltTravel % beltLoopLength;
      beltSlats.forEach((slat, index) => {
        placeBeltSlat(slat, index / beltSlatCount * beltLoopLength + beltDistance);
      });
      rollers.forEach((roller) => {
        roller.rotation.y = -beltTravel / beltRadius;
      });
      renderer.render(scene, camera);
    }
    animate();

    // Grafik hanya menyimpan 32 sampel getaran terbaru dari telemetri.
    function updateTrend(value) {
      vibrationSamples.push(value);
      if (vibrationSamples.length > maxSamples) vibrationSamples.shift();

      const low = Math.min(...vibrationSamples);
      const high = Math.max(...vibrationSamples);
      const spread = high - low || 1;
      const points = vibrationSamples.map((sample, index) => {
        const x = vibrationSamples.length === 1 ? 130 : (index / (vibrationSamples.length - 1)) * 260;
        const y = 66 - ((sample - low) / spread) * 54;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      trendLine.setAttribute("points", points.join(" "));
      trendEmpty.style.display = "none";
      trendCount.textContent = `${vibrationSamples.length} sampel`;
      trendSummary.textContent = `Sampel terbaru: ${value.toFixed(2)} m/s².`;
    }

    function updateTelemetry(payload) {
      const temperature = Number(payload.temperature);
      const vibration = Number(payload.vibration);
      const rpm = Number(payload.rpm);
      const validStatuses = ["HEALTHY", "WARNING", "CRITICAL"];

      if (![temperature, vibration, rpm].every(Number.isFinite) ||
          !validStatuses.includes(payload.status)) {
        reportTelemetryError("Data diterima, tetapi format telemetri tidak lengkap atau tidak valid.", null, false);
        console.error("[TELEMETRY ERROR] Payload MQTT tidak valid:", payload);
        return;
      }

      document.getElementById("val-temp").textContent = temperature.toFixed(2);
      document.getElementById("val-vib").textContent = vibration.toFixed(2);
      document.getElementById("val-rpm").textContent = String(Math.round(rpm));
      statusTag.textContent = payload.status;
      statusTag.className = `status-badge ${payload.status}`;
      dataMessage.textContent = "Telemetri diterima dari industrial/machine/telemetry.";
      sampleTime.textContent = `Data terakhir · ${new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }).format(new Date(Number(payload.timestamp) * 1000 || Date.now()))}`;

      // RPM dibatasi lalu diskalakan sebagai kecepatan visual, bukan konversi sabuk terkalibrasi.
      beltSpeed = Math.max(0, Math.min(rpm / 1500, 2)) * 0.85;
      const statusColors = {
        HEALTHY: 0x59c38a,
        WARNING: 0xedbd56,
        CRITICAL: 0xf0786e
      };
      materials.motorBody.color.setHex(statusColors[payload.status]);
      updateTrend(vibration);
      setConnectionState("online", "Broker MQTT terhubung");
    }

    let mqttClient = null;
    let isConnecting = false;
    // Generator Python dan dashboard berbagi broker HiveMQ dan topik payload telemetry ini.
    const brokerHost = "broker.hivemq.com";
    const brokerPort = 8000;
    const topic = "industrial/machine/telemetry";

    function subscribeToTelemetry() {
      setConnectionState("online", "Broker MQTT terhubung");
      dataMessage.textContent = "Terhubung. Menunggu telemetri pertama dari mesin.";
      mqttClient.subscribe(topic, {
        onFailure: (error) => reportTelemetryError("Gagal berlangganan topik telemetri.", error)
      });
    }

    function retryConnection() {
      if (mqttClient && mqttClient.isConnected()) {
        subscribeToTelemetry();
        return;
      }
      connectMqtt();
    }

    function connectMqtt() {
      if (isConnecting) return;
      if (!window.Paho || !window.Paho.MQTT) {
        reportTelemetryError("Pustaka MQTT tidak termuat. Periksa koneksi internet lalu coba lagi.");
        return;
      }

      isConnecting = true;
      setConnectionState("loading", "Menghubungkan MQTT");
      dataMessage.textContent = "Menghubungkan ke broker untuk menerima telemetri mesin.";
      const clientId = `web_twin_client_${Math.random().toString(36).slice(2, 10)}`;
      mqttClient = new Paho.MQTT.Client(brokerHost, brokerPort, clientId);
      mqttClient.onMessageArrived = (message) => {
        try {
          updateTelemetry(JSON.parse(message.payloadString));
        } catch (error) {
          reportTelemetryError("Pesan MQTT tidak dapat dibaca sebagai JSON.", error, false);
        }
      };
      mqttClient.onConnectionLost = (response) => {
        isConnecting = false;
        if (response && response.errorCode !== 0) {
          reportTelemetryError("Koneksi broker terputus. Coba sambungkan ulang.");
          console.error("[WEBSOCKET ERROR] Koneksi MQTT terputus:", response.errorMessage);
        }
      };
      mqttClient.connect({
        onSuccess: () => {
          isConnecting = false;
          subscribeToTelemetry();
        },
        onFailure: (error) => {
          isConnecting = false;
          reportTelemetryError("Broker tidak dapat dijangkau. Periksa jaringan, lalu coba lagi.", error);
        },
        timeout: 5,
        useSSL: location.protocol === "https:"
      });
    }

    retryButton.addEventListener("click", retryConnection);
    connectMqtt();