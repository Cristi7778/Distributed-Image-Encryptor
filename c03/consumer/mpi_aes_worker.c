#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <mpi.h>
#include <omp.h>
#include <openssl/aes.h>

#define MAX_IMAGE_SIZE (1024 * 1024 * 30)

void aes_process(unsigned char *data, int length, unsigned char *key, int encrypt) {
    AES_KEY aes_key;
    if (encrypt)
        AES_set_encrypt_key(key, 128, &aes_key);
    else
        AES_set_decrypt_key(key, 128, &aes_key);

    #pragma omp parallel for
    for (int i = 0; i < length; i += AES_BLOCK_SIZE) {
        if (encrypt)
            AES_ecb_encrypt(data + i, data + i, &aes_key, AES_ENCRYPT);
        else
            AES_ecb_encrypt(data + i, data + i, &aes_key, AES_DECRYPT);
    }
}

int main(int argc, char *argv[]) {
    MPI_Init(&argc, &argv);
    int rank, size;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);

    unsigned char operation;
    unsigned char key[16];
    unsigned char *image = NULL;
    int image_len = 0;
    unsigned char *local_chunk = NULL;
    int local_chunk_size;

    if (rank == 0) {
        // Read operation
        fread(&operation, 1, 1, stdin);

        // Read AES key
        fread(key, 1, 16, stdin);

        // Read image data
        image = malloc(MAX_IMAGE_SIZE);
        image_len = fread(image, 1, MAX_IMAGE_SIZE, stdin);

        // Pad image length to be divisible by AES_BLOCK_SIZE * size
        int block_size = AES_BLOCK_SIZE;
        int padded_len = image_len;
        if (padded_len % (block_size * size) != 0)
            padded_len += (block_size * size) - (padded_len % (block_size * size));
        memset(image + image_len, 0, padded_len - image_len);
        image_len = padded_len;
    }

    // Broadcast operation and key
    MPI_Bcast(&operation, 1, MPI_BYTE, 0, MPI_COMM_WORLD);
    MPI_Bcast(key, 16, MPI_BYTE, 0, MPI_COMM_WORLD);
    MPI_Bcast(&image_len, 1, MPI_INT, 0, MPI_COMM_WORLD);

    // Allocate local chunk
    local_chunk_size = image_len / size;
    local_chunk = malloc(local_chunk_size);

    // Scatter image data
    MPI_Scatter(image, local_chunk_size, MPI_BYTE,
                local_chunk, local_chunk_size, MPI_BYTE,
                0, MPI_COMM_WORLD);

    // Encrypt/Decrypt
    aes_process(local_chunk, local_chunk_size, key, operation == 1);

    // Gather result
    MPI_Gather(local_chunk, local_chunk_size, MPI_BYTE,
               image, local_chunk_size, MPI_BYTE,
               0, MPI_COMM_WORLD);

    // Output result
    if (rank == 0) {
        fwrite(image, 1, image_len, stdout);
        free(image);
    }

    free(local_chunk);
    MPI_Finalize();
    return 0;
}
