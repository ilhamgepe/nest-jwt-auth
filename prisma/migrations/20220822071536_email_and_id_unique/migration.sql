/*
  Warnings:

  - A unique constraint covering the columns `[id,email]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `users_email_key` ON `users`;

-- CreateIndex
CREATE UNIQUE INDEX `users_id_email_key` ON `users`(`id`, `email`);
