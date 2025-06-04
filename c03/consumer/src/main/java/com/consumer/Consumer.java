package com.consumer;

import com.rabbitmq.client.*;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;

public class Consumer {
    private static final String RABBITMQ_HOST = "c02";
    private static final String EXCHANGE_NAME = "aes_exchange";
    private static final String QUEUE_NAME = "aes_queue";

    public static void main(String[] args) throws Exception {
        ConnectionFactory factory = new ConnectionFactory();
        factory.setHost(RABBITMQ_HOST);
        factory.setUsername("user");
        factory.setPassword("cristi123");

        Connection connection = factory.newConnection();
        Channel channel = connection.createChannel();

        channel.exchangeDeclare(EXCHANGE_NAME, BuiltinExchangeType.TOPIC, true);
        channel.queueDeclare(QUEUE_NAME, true, false, false, null);
        channel.queueBind(QUEUE_NAME, EXCHANGE_NAME, "aes.*");

        System.out.println("[*] Waiting for messages...");

        DeliverCallback callback = (consumerTag, delivery) -> {
            byte[] inputData = delivery.getBody();
            String routingKey = delivery.getEnvelope().getRoutingKey();

            System.out.print("Received (first 30 bytes): ");
            for (int i = 0; i < Math.min(30, inputData.length); i++) {
                System.out.printf("%02X ", inputData[i]);
            }
            System.out.println();
            System.out.println("Routing key: " + routingKey);

            try {
                ProcessBuilder pb = new ProcessBuilder(
                    "mpirun", "-np", "2", "--allow-run-as-root",
                    "/consumer/aes_worker"
                );
                pb.redirectError(ProcessBuilder.Redirect.INHERIT);
                Process process = pb.start();

                // Write input to the AES worker
                try (OutputStream procStdin = process.getOutputStream()) {
                    procStdin.write(inputData);
                }

                // Read output from the AES worker
                ByteArrayOutputStream outputBuffer = new ByteArrayOutputStream();
                try (InputStream procStdout = process.getInputStream()) {
                    byte[] buffer = new byte[1024];
                    int read;
                    while ((read = procStdout.read(buffer)) != -1) {
                        outputBuffer.write(buffer, 0, read);
                    }
                }

                int exitCode = process.waitFor();
                if (exitCode != 0) {
                    System.err.println("mpirun failed with exit code: " + exitCode);
                    return;
                }

                byte[] resultData = outputBuffer.toByteArray();

                System.out.print("Output (first 30 bytes): ");
                for (int i = 0; i < Math.min(30, resultData.length); i++) {
                    System.out.printf("%02X ", resultData[i]);
                }
                System.out.println();

                // Determine type from routing key
                String type = routingKey.contains("enc") ? "enc" : "dec";
                String uploadUrl = "http://c05:4000/upload-" + type;

                // Send to c05 via raw POST (no multipart)
                HttpURLConnection conn = (HttpURLConnection) new URL(uploadUrl).openConnection();
                conn.setDoOutput(true);
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "image/bmp");

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(resultData);
                }

                int responseCode = conn.getResponseCode();
                System.out.println("Sent to " + uploadUrl + ": HTTP " + responseCode);

            } catch (Exception e) {
                e.printStackTrace();
            }
        };

        channel.basicConsume(QUEUE_NAME, true, callback, consumerTag -> {});
        Thread.currentThread().join();
    }
}
