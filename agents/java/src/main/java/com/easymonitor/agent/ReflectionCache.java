package com.easymonitor.agent;

import java.lang.reflect.Method;
import java.util.concurrent.ConcurrentHashMap;

public class ReflectionCache {
    private static final ClassValue<ConcurrentHashMap<String, Method>> CACHE = new ClassValue<ConcurrentHashMap<String, Method>>() {
        @Override
        protected ConcurrentHashMap<String, Method> computeValue(Class<?> type) {
            return new ConcurrentHashMap<>();
        }
    };

    public static Method getMethod(Class<?> clazz, String methodName, Class<?>... params) {
        String key = methodName;
        if (params.length > 0) {
            StringBuilder sb = new StringBuilder(methodName);
            for (Class<?> p : params) {
                sb.append(",").append(p.getName());
            }
            key = sb.toString();
        }

        ConcurrentHashMap<String, Method> map = CACHE.get(clazz);
        Method m = map.get(key);
        if (m == null) {
            try {
                m = clazz.getMethod(methodName, params);
                map.put(key, m);
            } catch (Exception e) {
                // Return null if not found
            }
        }
        return m;
    }
}
