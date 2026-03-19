const dgram = require('dgram');
const client = dgram.createSocket('udp4');

const KUBE_NAMESPACE = process.env.KUBE_NAMESPACE || "default";
const POD_ID = process.env.POD_ID || "unknown-pod";
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || "unknown-service";

function sendLog(levelStr, message, meta = {}) {
  const levelNum = levelStr === "ERROR" ? 3 : 6; // Standard syslog severity integers
  
  const payload = {
    version: "1.1",
    host: POD_ID,
    short_message: message,
    level: levelNum,
    _service: SERVICE_NAME,
    _kube_namespace: KUBE_NAMESPACE,
    ...meta
  };
  
  const buffer = Buffer.from(JSON.stringify(payload));
  
  // Asynchronously dispatch datagram natively to local Node Agent 
  client.send(buffer, 12201, '127.0.0.1', (err) => {
    if (err) {
      // Intentionally swallow to prevent backend crashing if UDP buffers fail
      // console.error("UDP log flush explicitly failed:", err);
    }
  });
}

module.exports = {
  info: (msg, meta) => sendLog("INFO", msg, meta),
  error: (msg, meta) => sendLog("ERROR", msg, meta),
};
