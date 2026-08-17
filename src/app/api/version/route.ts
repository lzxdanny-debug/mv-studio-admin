import { BUILD_INFO } from '@/generated/build-info';

export async function GET() {
  return Response.json(BUILD_INFO);
}
