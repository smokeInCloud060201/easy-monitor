package com.easymonitor.agent;

import java.lang.instrument.Instrumentation;

public class EasyMonitorAgent {
    public static void premain(String agentArgs, Instrumentation inst) {
        String service = System.getenv().getOrDefault("OTEL_SERVICE_NAME", "java-app");
        System.out.println("  [EasyMonitor] Pure Java ByteBuddy Agent successfully attached to " + service + "!");
        
        // Native byte-code instrumentation via ByteBuddy will hook into JVM classes here
        // Ex: new AgentBuilder.Default().type(...).transform(...).installOn(inst);
    }
}
