package com.easymonitor.agent;

import java.lang.instrument.Instrumentation;
import java.util.logging.Logger;

import net.bytebuddy.agent.builder.AgentBuilder;
import net.bytebuddy.matcher.ElementMatchers;

public class EasyMonitorAgent {

        private static final Logger log = Logger.getLogger(EasyMonitorAgent.class.getName());

        public static void premain(String agentArgs, Instrumentation inst) {
                String service = System.getenv().getOrDefault("OTEL_SERVICE_NAME", "java-app");
                LogInterceptor.install(service);

                log.info("[EasyMonitor] Native Java Agent attached to " + service + "!");

                new AgentBuilder.Default()
                                .type(ElementMatchers
                                                .hasSuperType(ElementMatchers.named("javax.servlet.http.HttpServlet"))
                                                .or(ElementMatchers.hasSuperType(ElementMatchers
                                                                .named("jakarta.servlet.http.HttpServlet"))))
                                .transform(new AgentBuilder.Transformer.ForAdvice()
                                                .advice(ElementMatchers.named("service"),
                                                                "com.easymonitor.agent.ServletAdvice"))
                                .installOn(inst);

                new AgentBuilder.Default()
                                .type(ElementMatchers.isSubTypeOf(java.net.HttpURLConnection.class))
                                .transform(new AgentBuilder.Transformer.ForAdvice()
                                                .advice(ElementMatchers.named("connect")
                                                                .or(ElementMatchers.named("getInputStream")),
                                                                "com.easymonitor.agent.HttpAdvice"))
                                .installOn(inst);

                new AgentBuilder.Default()
                                .type(ElementMatchers.hasSuperType(ElementMatchers.named("java.sql.Connection")))
                                .transform(new AgentBuilder.Transformer.ForAdvice()
                                                .advice(ElementMatchers.nameStartsWith("prepareStatement"),
                                                                "com.easymonitor.agent.JdbcAdvice$PrepareAdvice"))
                                .installOn(inst);

                new AgentBuilder.Default()
                                .type(ElementMatchers.hasSuperType(ElementMatchers.named("java.sql.PreparedStatement")))
                                .transform(new AgentBuilder.Transformer.ForAdvice()
                                                .advice(ElementMatchers.nameStartsWith("execute"),
                                                                "com.easymonitor.agent.JdbcAdvice$ExecuteAdvice"))
                                .installOn(inst);

                new AgentBuilder.Default()
                                .type(ElementMatchers.hasSuperType(ElementMatchers
                                                .named("org.springframework.http.client.ClientHttpRequest")))
                                .transform(new AgentBuilder.Transformer.ForAdvice()
                                                .advice(ElementMatchers.named("execute"),
                                                                "com.easymonitor.agent.SpringHttpAdvice"))
                                .installOn(inst);
        }
}
