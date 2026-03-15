import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @MaxLength(500)
  name: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'null' || value === null ? null : value,
  )
  @ValidateIf((_, v) => v != null)
  @IsUUID(4, { message: 'parentId must be a valid UUID' })
  parentId?: string | null;
}
