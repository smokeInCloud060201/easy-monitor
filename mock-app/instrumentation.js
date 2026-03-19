const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { CustomTraceExporter } = require('./custom-exporter');

const sdk = new NodeSDK({
  traceExporter: new CustomTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()]
});

sdk.start();
