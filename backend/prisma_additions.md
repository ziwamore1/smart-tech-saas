// Prisma Schema Additions
// Add these models to your existing Prisma schema

model Library {
  id          String   @id @default(cuid())
  title       String
  description String?
  category   String   @default("resource") // textbook, syllabus, guide, exam, lesson, resource
  fileUrl    String?
  fileSize   Int?
  fileType   String?
  schoolId   String
  school    School   @relation(fields: [schoolId], references: [id])
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Gallery {
  id          String        @id @default(cuid())
  title       String
  description String?
  eventDate  DateTime?
  schoolId   String
  school    School       @relation(fields: [schoolId], references: [id])
  photos     GalleryPhoto[]
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
}

model GalleryPhoto {
  id        String   @id @default(cuid())
  url       String
  caption  String?
  galleryId String
  gallery   Gallery @relation(fields: [galleryId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}