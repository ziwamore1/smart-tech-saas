const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.smarttechsaas.com/api/v1';

export interface MockupImage {
  id: string;
  label: string;
  role: string;
  category: string;
  imageUrl: string;
  thumbnailUrl?: string;
}

export async function fetchMockups(): Promise<MockupImage[]> {
  try {
    const res = await fetch(`${API_URL}/public/landing-mockups`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
