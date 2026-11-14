import { BadRequestException } from '@nestjs/common';

export function branchCoordinates(dto: { latitude?: number | null; longitude?: number | null }) {
  const { latitude, longitude } = dto;
  if (latitude === undefined && longitude === undefined) return {};
  if (latitude === null && longitude === null) return { latitude: null, longitude: null };
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new BadRequestException('Choose a valid map location with both latitude and longitude.');
  }
  return { latitude, longitude };
}
