This is my project for encrypting and decrypting images using a distributed system to spread the load.
It uses AES encryption, ECB mode with 16 byte keys.

The solution is spread deployed on 6 different containers:

C01: It runs the frontend built in React, and a lightweight Javalin backend that receives the requests for encryption/decryption and posts them in a RabbitMQ Queue.

C02: It is a RabbitMQ Broker

C03: Consumes messages from the queue, and launches native processes across itself and C04, using MPI and openMP for picture distribution and encryption. Upon the finishing of the finishing of the process the image is posted into C05 using REST API.

C04: Helps encrypting/decrypting in parallel.

C05: Is a lightweight Node.js backend service that accepts and stores raw BMP images in a MySQL database. It also notifies the frontend in C01 that the picture is ready.

C06: This is the MySQL database used for persistent data storage.
