import { IsString, IsHexColor, IsNotEmpty, Length, Matches } from 'class-validator';

export class CreateColorDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @Length(2, 50, { message: 'El nombre debe tener entre 2 y 50 caracteres' })
  name: string;

  @IsHexColor({ message: 'El código hex debe ser un color válido' })
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El código hex debe tener el formato #RRGGBB (ej: #FF5733)' })
  hexCode: string;
}
