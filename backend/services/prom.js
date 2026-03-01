import promClient from "prom-client";

const collectDefaultMetrics = promClient.collectDefaultMetrics;
const register = promClient.register;
