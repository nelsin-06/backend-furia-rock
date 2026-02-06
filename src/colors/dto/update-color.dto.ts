import { IsString, IsHexColor, IsBoolean, IsOptional, Length, Matches } from 'class-validator';

export class UpdateColorDto {
  @IsOptional()
  @IsString()
  @Length(2, 50, { message: 'El nombre debe tener entre 2 y 50 caracteres' })
  name?: string;

  @IsOptional()
  @IsHexColor({ message: 'El código hex debe ser un color válido' })
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El código hex debe tener el formato #RRGGBB (ej: #FF5733)' })
  hexCode?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
