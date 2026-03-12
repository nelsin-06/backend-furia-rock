import { Logger } from '@nestjs/common';
import { QualityRepository } from '../qualities/repositories/quality.repository';

const logger = new Logger('QualitiesSeed');

const DEFAULT_QUALITIES = [
  { name: 'DTF', description: 'Impresion DTF (Direct to Film)' },
  { name: 'DTG', description: 'Impresion DTG (Direct to Garment)' },
];

export async function seedQualities(
  qualityRepository: QualityRepository,
): Promise<void> {
  let created = 0;
  let skipped = 0;

  for (const qualityData of DEFAULT_QUALITIES) {
    const existing = await qualityRepository.findByName(qualityData.name);

    if (existing) {
      logger.log(`Quality "${qualityData.name}" already exists — skipped.`);
      skipped++;
      continue;
    }

    const quality = qualityRepository.create({ ...qualityData, active: true });
    await qualityRepository.save(quality);
    logger.log(`Quality "${qualityData.name}" created.`);
    created++;
  }

  logger.log(`Qualities seed done — created: ${created}, skipped: ${skipped}.`);
}
