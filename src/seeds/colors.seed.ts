import { Logger } from '@nestjs/common';
import { ColorRepository } from '../colors/repositories/color.repository';

const logger = new Logger('ColorsSeed');

const DEFAULT_COLORS = [
  { name: 'Negro', hexCode: '#000000' },
  { name: 'Blanco', hexCode: '#FFFFFF' },
  { name: 'Rojo', hexCode: '#FF0000' },
  { name: 'Azul', hexCode: '#0000FF' },
  { name: 'Verde', hexCode: '#008000' },
  { name: 'Gris', hexCode: '#808080' },
];

export async function seedColors(
  colorRepository: ColorRepository,
): Promise<void> {
  let created = 0;
  let skipped = 0;

  for (const colorData of DEFAULT_COLORS) {
    const hexCode = colorData.hexCode.toUpperCase();
    const existing = await colorRepository.findByHexCode(hexCode);

    if (existing) {
      logger.log(`Color "${colorData.name}" (${hexCode}) already exists — skipped.`);
      skipped++;
      continue;
    }

    const color = colorRepository.create({ ...colorData, hexCode, active: true });
    await colorRepository.save(color);
    logger.log(`Color "${colorData.name}" (${hexCode}) created.`);
    created++;
  }

  logger.log(`Colors seed done — created: ${created}, skipped: ${skipped}.`);
}
