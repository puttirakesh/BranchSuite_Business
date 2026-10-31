import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';

const SETTING_KEY = 'general';
const DEFAULT_SETTINGS = {
  platformName: 'BranchSuite',
  supportEmail: '',
  supportPhone: '',
  announcement: '',
  supportPortalUrl: '',
  displayAnnouncement: false,
};
type GeneralSettings = typeof DEFAULT_SETTINGS;

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getGeneral() {
    const record = await this.prisma.platformSetting.findUnique({ where: { key: SETTING_KEY } });
    const raw = record?.value;
    const data: GeneralSettings = { ...DEFAULT_SETTINGS };
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof GeneralSettings)[]) {
        const value = (raw as Record<string, unknown>)[key];
        if (typeof value === typeof DEFAULT_SETTINGS[key]) {
          // Values are stored only after DTO validation.
          (data as Record<string, unknown>)[key] = value;
        }
      }
    }
    return { settings: data, version: record?.version ?? 0, updatedAt: record?.updatedAt ?? null };
  }

  async updateGeneral(dto: UpdatePlatformSettingsDto, actorId: string) {
    const patch = Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined));
    if (!Object.keys(patch).length) throw new BadRequestException('Supply at least one setting');
    return this.prisma.$transaction(async tx => {
      // Lock the single settings row to serialize concurrent changes.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(791924001)`;
      const current = await tx.platformSetting.findUnique({ where: { key: SETTING_KEY } });
      const oldSettings: GeneralSettings = { ...DEFAULT_SETTINGS };
      if (current?.value && typeof current.value === 'object' && !Array.isArray(current.value)) {
        Object.assign(oldSettings, current.value);
      }
      const nextSettings = { ...oldSettings, ...patch };
      const updated = await tx.platformSetting.upsert({
        where: { key: SETTING_KEY },
        create: { key: SETTING_KEY, value: nextSettings as Prisma.InputJsonValue, version: 1, updatedById: actorId },
        update: { value: nextSettings as Prisma.InputJsonValue, version: { increment: 1 }, updatedById: actorId },
      });
      const changed = Object.keys(patch).filter(key => oldSettings[key as keyof GeneralSettings] !== nextSettings[key as keyof GeneralSettings]);
      await tx.platformSettingChange.create({
        data: { settingKey: SETTING_KEY, actorId, changes: { keys: changed, previous: Object.fromEntries(changed.map(key => [key, oldSettings[key as keyof GeneralSettings]])), next: Object.fromEntries(changed.map(key => [key, nextSettings[key as keyof GeneralSettings]])) } as Prisma.InputJsonValue },
      });
      return { settings: nextSettings, version: updated.version, updatedAt: updated.updatedAt };
    });
  }

  async history(page: number, limit: number) {
    const where = { settingKey: SETTING_KEY };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.platformSettingChange.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.platformSettingChange.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
