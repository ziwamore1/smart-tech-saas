'use client';

interface Icon3DProps {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const iconMap: Record<string, string> = {
  'students': '/3d-icons/education.png',
  'teachers': '/3d-icons/idea.png',
  'classes': '/3d-icons/blocks.png',
  'subjects': '/3d-icons/book.png',
  'dashboard': '/3d-icons/board.png',
  'timetable': '/3d-icons/app.png',
  'attendance': '/3d-icons/stationery.png',
  'assessments': '/3d-icons/online.png',
  'results': '/3d-icons/degree2.png',
  'reports': '/3d-icons/certificate.png',
  'exam': '/3d-icons/education.png',
  'fees': '/3d-icons/startup.png',
  'analytics': '/3d-icons/edu3.png',
  'communications': '/3d-icons/board.png',
  'library': '/3d-icons/book2.png',
  'lesson': '/3d-icons/learning.png',
  'gallery': '/3d-icons/edu2.png',
  'ai': '/3d-icons/idea.png',
  'settings': '/3d-icons/stationery.png',
  'schools': '/3d-icons/startup.png',
  'template': '/3d-icons/certificate.png',
  'verification': '/3d-icons/education.png',
  'intelligence': '/3d-icons/idea.png',
  'audit': '/3d-icons/board.png',
  'branding': '/3d-icons/app.png',
  'marketplace': '/3d-icons/startup.png',
  'signatures': '/3d-icons/degree2.png',
  'stamps': '/3d-icons/degree2.png',
  'profile': '/3d-icons/student.png',
};

export default function Icon3D({ name, size = 48, className, style }: Icon3DProps) {
  const src = iconMap[name?.toLowerCase() ?? ''] || '/3d-icons/education.png';

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={className}
      style={{
        objectFit: 'contain',
        ...style,
      }}
    />
  );
}
