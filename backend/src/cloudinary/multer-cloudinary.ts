import { memoryStorage } from 'multer';

export const cloudinaryMemoryStorage = () => memoryStorage();

export const CLOUDINARY_FILE_FILTER = (req: any, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
  ];
  const blockedExts = ['.exe', '.bat', '.js', '.sh', '.php', '.cmd', '.vbs', '.ps1'];
  const ext = '.' + file.originalname.split('.').pop()?.toLowerCase();
  if (blockedExts.includes(ext)) {
    cb(new Error(`File type ${ext} is not allowed`), false);
    return;
  }
  if (!allowedMimes.includes(file.mimetype)) {
    cb(new Error(`MIME type ${file.mimetype} is not allowed`), false);
    return;
  }
  cb(null, true);
};
