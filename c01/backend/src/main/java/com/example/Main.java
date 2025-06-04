package com.example;
import io.javalin.Javalin;
import com.rabbitmq.client.*;
import io.javalin.http.staticfiles.Location;
import java.util.List;
public class Main {

    private static final String RABBITMQ_HOST = "c02";
    private static final String EXCHANGE_NAME = "aes_exchange";

    public static void main(String[] args) throws Exception {	
	Javalin app = Javalin.create(config -> {
            config.plugins.enableCors(cors -> {
                cors.add(corsConfig -> {
                    corsConfig.anyHost(); // Allow all origins
                    corsConfig.allowCredentials = true; // Allow credentials
                });
            });
        }).start(8080);
        app.post("/encrypt", ctx -> {
            // Receive the image file
            var photoFile = ctx.uploadedFile("photo");
            if (photoFile == null) {
                ctx.status(400).result("Missing photo file");
                return;
            }
	    byte[] image = photoFile.content().readAllBytes();


            // Receive the AES key file (binary blob)
            var keyFile = ctx.uploadedFile("aesKey");
            if (keyFile == null) {
                ctx.status(400).result("Missing AES key file");
                return;
            }
            byte[] key = keyFile.content().readAllBytes();

            // Receive the operation parameter as a form field
            String operation = ctx.formParam("operation");
            if (operation == null || (!operation.equals("encrypt") && !operation.equals("decrypt"))) {
                ctx.status(400).result("Invalid or missing operation parameter");
                return;
            }

            // Combine operation + key + image in some format before publishing
            // For example: [operation (as a byte), key bytes, image bytes]
            // Let's encode operation as a single byte: 0x01 for encrypt, 0x02 for decrypt
            byte operationByte = operation.equals("encrypt") ? (byte)1 : (byte)2;

            byte[] combined = new byte[1 + key.length + image.length];
            combined[0] = operationByte;
            System.arraycopy(key, 0, combined, 1, key.length);
            System.arraycopy(image, 0, combined, 1 + key.length, image.length);

            // Publish to RabbitMQ
            ConnectionFactory factory = new ConnectionFactory();
            factory.setHost(RABBITMQ_HOST);
	    factory.setUsername("user");
     	    factory.setPassword("cristi123");
            try (Connection connection = factory.newConnection();
                 Channel channel = connection.createChannel()) {
                channel.exchangeDeclare(EXCHANGE_NAME, BuiltinExchangeType.TOPIC, true);
                channel.basicPublish(EXCHANGE_NAME, "aes." + operation, null, combined);
                ctx.result("Message published to topic.");
            } catch (Exception e) {
                e.printStackTrace();
                ctx.status(500).result("Failed to publish message");
            }
		for (int i = 0; i <Math.min(20, combined.length); i++) {
		    System.out.printf("%02X ", combined[i]);
		}
        });
    }
}

