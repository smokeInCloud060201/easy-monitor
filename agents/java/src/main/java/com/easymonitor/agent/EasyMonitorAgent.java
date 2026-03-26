package com.easymonitor.agent;

import java.lang.instrument.Instrumentation;
import net.bytebuddy.agent.builder.AgentBuilder;
import net.bytebuddy.matcher.ElementMatchers;

public class EasyMonitorAgent {
    public static void premain(String agentArgs, Instrumentation inst) {
        String service = System.getenv().getOrDefault("OTEL_SERVICE_NAME", "java-app");
        System.out.println("  [EasyMonitor] Pure Java Servlet ByteBuddy Agent successfully attached to " + service + "!");
        
        new AgentBuilder.Default()
            .type(ElementMatchers.hasSuperType(ElementMatchers.named("javax.servlet.http.HttpServlet"))
                    .or(ElementMatchers.hasSuperType(ElementMatchers.named("jakarta.servlet.http.HttpServlet"))))
            .transform(new AgentBuilder.Transformer.ForAdvice()
                    .advice(ElementMatchers.named("service"), "com.easymonitor.agent.ServletAdvice"))
            .installOn(inst);
    }
}
